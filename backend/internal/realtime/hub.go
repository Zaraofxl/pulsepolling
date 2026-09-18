package realtime

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"pulsepoll-backend/internal/models"
	"pulsepoll-backend/internal/repository"
)

// ============================================================================
// WEBSOCKET REALTIME HUB
// Manages connected WebSocket clients grouped by Poll ID, receives live events
// from the Redis Pub/Sub layer, and distributes them in real-time.
// ============================================================================

// ClientMessage represents an inbound message from a client socket.
type ClientMessage struct {
	PollID  string
	Payload []byte
	Sender  *Client
}

// Hub maintains active client connections and routes broadcast messages.
type Hub struct {
	// clients: Map of PollID -> Set of active connected *Client
	clients map[string]map[*Client]bool

	// Register: Inbound requests to add a client to a poll's broadcast room
	Register chan *Client

	// Unregister: Inbound requests to remove a client
	Unregister chan *Client

	// Inbound: Inbound messages received from client WebSocket connections
	Inbound chan ClientMessage

	// realtimeRepo: Reference to Redis realtime repository for pub/sub subscriptions
	realtimeRepo repository.RealtimeRepository

	// activeSubs: Map of PollID -> active unsubscribe cancellation function
	activeSubs map[string]context.CancelFunc

	// mu: Mutex protecting the clients and activeSubs maps
	mu sync.RWMutex
}

// NewHub creates a new Hub instance.
func NewHub(realtimeRepo repository.RealtimeRepository) *Hub {
	return &Hub{
		clients:      make(map[string]map[*Client]bool),
		Register:     make(chan *Client),
		Unregister:   make(chan *Client),
		Inbound:      make(chan ClientMessage, 256),
		realtimeRepo: realtimeRepo,
		activeSubs:   make(map[string]context.CancelFunc),
	}
}

// Run starts the central hub event loop in a background goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			if _, exists := h.clients[client.pollID]; !exists {
				h.clients[client.pollID] = make(map[*Client]bool)
				// Subscribe to Redis Pub/Sub updates for this poll
				h.subscribeToPollRedis(client.pollID)
			}
			h.clients[client.pollID][client] = true
			viewerCount := len(h.clients[client.pollID])
			h.mu.Unlock()

			log.Printf("[WebSocket] Client connected to poll %s (Active Viewers: %d)", client.pollID, viewerCount)
			// Broadcast viewer count update to poll room
			h.broadcastViewerCount(client.pollID, int64(viewerCount))

		case client := <-h.Unregister:
			h.mu.Lock()
			if room, exists := h.clients[client.pollID]; exists {
				if _, ok := room[client]; ok {
					delete(room, client)
					close(client.send)
					viewerCount := len(room)
					if viewerCount == 0 {
						delete(h.clients, client.pollID)
						// Cancel Redis subscription for idle poll
						if cancel, found := h.activeSubs[client.pollID]; found {
							cancel()
							delete(h.activeSubs, client.pollID)
						}
					}
					h.mu.Unlock()
					log.Printf("[WebSocket] Client left poll %s (Remaining Viewers: %d)", client.pollID, viewerCount)
					h.broadcastViewerCount(client.pollID, int64(viewerCount))
					continue
				}
			}
			h.mu.Unlock()

		case msg := <-h.Inbound:
			// Process incoming client message (e.g. client sent emoji reaction)
			var reaction models.LiveReaction
			if err := json.Unmarshal(msg.Payload, &reaction); err == nil && reaction.Emoji != "" {
				reaction.PollID = msg.PollID
				_ = h.realtimeRepo.PublishReaction(context.Background(), msg.PollID, &reaction)
			}
		}
	}
}

// subscribeToPollRedis establishes Redis Pub/Sub channels for live vote counts and reactions.
func (h *Hub) subscribeToPollRedis(pollID string) {
	ctx, cancel := context.WithCancel(context.Background())
	h.activeSubs[pollID] = cancel

	// 1. Subscribe to Live Vote Updates
	go func() {
		updateChan, unsub, err := h.realtimeRepo.SubscribeVoteUpdates(ctx, pollID)
		if err != nil {
			log.Printf("[Redis] Failed to subscribe to vote updates for %s: %v", pollID, err)
			return
		}
		defer unsub()

		for {
			select {
			case <-ctx.Done():
				return
			case update, ok := <-updateChan:
				if !ok {
					return
				}
				h.BroadcastToPoll(pollID, map[string]interface{}{
					"type": "VOTE_UPDATE",
					"data": update,
				})
			}
		}
	}()

	// 2. Subscribe to Floating Live Reactions
	go func() {
		reactChan, unsub, err := h.realtimeRepo.SubscribeReactions(ctx, pollID)
		if err != nil {
			log.Printf("[Redis] Failed to subscribe to reactions for %s: %v", pollID, err)
			return
		}
		defer unsub()

		for {
			select {
			case <-ctx.Done():
				return
			case reaction, ok := <-reactChan:
				if !ok {
					return
				}
				h.BroadcastToPoll(pollID, map[string]interface{}{
					"type": "LIVE_REACTION",
					"data": reaction,
				})
			}
		}
	}()
}

// BroadcastToPoll sends a JSON message to all WebSocket clients currently viewing a poll.
func (h *Hub) BroadcastToPoll(pollID string, message interface{}) {
	payload, err := json.Marshal(message)
	if err != nil {
		log.Printf("[Hub] JSON encode error: %v", err)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	room, exists := h.clients[pollID]
	if !exists {
		return
	}

	for client := range room {
		select {
		case client.send <- payload:
		default:
			// If buffer is full, remove stalled client
			close(client.send)
			delete(room, client)
		}
	}
}

// broadcastViewerCount notifies all connected room clients of the active live spectator count.
func (h *Hub) broadcastViewerCount(pollID string, count int64) {
	h.BroadcastToPoll(pollID, map[string]interface{}{
		"type": "VIEWER_COUNT",
		"data": map[string]interface{}{
			"poll_id":      pollID,
			"viewer_count": count,
		},
	})
}

// ServeWS upgrades the incoming HTTP request to a WebSocket connection and registers client with hub.
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request, pollID string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WebSocket] Upgrade error: %v", err)
		return
	}

	client := &Client{
		hub:    h,
		conn:   conn,
		pollID: pollID,
		send:   make(chan []byte, 256),
	}

	h.Register <- client

	// Start goroutines for client pumps
	go client.WritePump()
	go client.ReadPump()
}
