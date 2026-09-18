package realtime

import (
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

// ============================================================================
// WEBSOCKET CLIENT CONNECTION
// Manages an individual client connection, bidirectional messaging,
// ping-pong heartbeat health checks, and graceful teardown.
// ============================================================================

const (
	// writeWait: Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// pongWait: Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// pingPeriod: Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// maxMessageSize: Maximum message size allowed from peer (in bytes)
	maxMessageSize = 4096
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// CheckOrigin allows all frontend origins to connect securely
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Client represents a connected WebSocket subscriber viewing a specific poll.
type Client struct {
	// hub: Reference to the central WebSocket hub
	hub *Hub

	// conn: Underlying WebSocket network socket
	conn *websocket.Conn

	// pollID: The poll identifier this client is subscribed to
	pollID string

	// send: Buffered channel of outbound messages
	send chan []byte
}

// ReadPump pumps incoming messages from the WebSocket connection to the hub.
// Application runs ReadPump in a per-connection goroutine.
func (c *Client) ReadPump() {
	defer func() {
		c.hub.Unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WebSocket] Read error: %v", err)
			}
			break
		}
		// Forward any inbound messages (like live emoji reactions or viewer ping) to hub
		c.hub.Inbound <- ClientMessage{
			PollID:  c.pollID,
			Payload: message,
			Sender:  c,
		}
	}
}

// WritePump pumps outbound messages from the hub to the WebSocket connection.
// Application runs WritePump in a per-connection goroutine.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			if _, err := w.Write(message); err != nil {
				return
			}

			// Flush queued messages to optimize TCP frame packet batching
			n := len(c.send)
			for i := 0; i < n; i++ {
				if _, err := w.Write(<-c.send); err != nil {
					return
				}
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
