package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"sync"
	"time"

	"pulsepoll-backend/internal/models"

	"github.com/redis/go-redis/v9"
)

// ============================================================================
// REDIS REALTIME REPOSITORY IMPLEMENTATION
// Utilizes Redis Hashes (HINCRBY) for atomic counters, Sets (SADD/SISMEMBER)
// for voter deduplication, and Pub/Sub for real-time live streaming across nodes.
// Includes a fully thread-safe in-memory fallback adapter.
// ============================================================================

type RedisRepository struct {
	client *redis.Client
}

// NewRedisRepository establishes a connection to the Redis server.
func NewRedisRepository(ctx context.Context, addr string, password string, db int) (*RedisRepository, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     password,
		DB:           db,
		DialTimeout:  3 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	// Ping Redis instance
	pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	if err := rdb.Ping(pingCtx).Err(); err != nil {
		return nil, err
	}

	log.Printf("[Redis] Successfully connected to Redis instance at: %s", addr)
	return &RedisRepository{client: rdb}, nil
}

// Helper keys
func pollVotesKey(pollID string) string {
	return fmt.Sprintf("poll:%s:votes", pollID)
}

func pollVotersKey(pollID string) string {
	return fmt.Sprintf("poll:%s:voters", pollID)
}

func pollChannelKey(pollID string) string {
	return fmt.Sprintf("channel:poll:%s:updates", pollID)
}

func pollReactionsKey(pollID string) string {
	return fmt.Sprintf("channel:poll:%s:reactions", pollID)
}

// IncrementVoteCount atomically increments vote counts for selected options using Redis HINCRBY.
func (r *RedisRepository) IncrementVoteCount(ctx context.Context, pollID string, optionIDs []string) (map[string]int64, int64, error) {
	key := pollVotesKey(pollID)
	pipe := r.client.Pipeline()

	// Pipeline atomic increments
	for _, optID := range optionIDs {
		pipe.HIncrBy(ctx, key, optID, 1)
	}

	_, err := pipe.Exec(ctx)
	if err != nil {
		return nil, 0, err
	}

	// Fetch updated tallies
	return r.GetVoteCounts(ctx, pollID)
}

// GetVoteCounts retrieves the entire current vote hash for the poll.
func (r *RedisRepository) GetVoteCounts(ctx context.Context, pollID string) (map[string]int64, int64, error) {
	key := pollVotesKey(pollID)
	result, err := r.client.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, 0, err
	}

	counts := make(map[string]int64)
	var total int64 = 0

	for optID, valStr := range result {
		val, _ := strconv.ParseInt(valStr, 10, 64)
		counts[optID] = val
		total += val
	}

	return counts, total, nil
}

// RecordVoter registers a voter identifier in the Redis Set to prevent double voting.
func (r *RedisRepository) RecordVoter(ctx context.Context, pollID string, voterIdentifier string) error {
	key := pollVotersKey(pollID)
	return r.client.SAdd(ctx, key, voterIdentifier).Err()
}

// HasVoted checks if the voter identifier already exists in the Redis Set.
func (r *RedisRepository) HasVoted(ctx context.Context, pollID string, voterIdentifier string) (bool, error) {
	key := pollVotersKey(pollID)
	return r.client.SIsMember(ctx, key, voterIdentifier).Result()
}

// PublishVoteUpdate broadcasts a LiveVoteUpdate JSON payload over Redis Pub/Sub.
func (r *RedisRepository) PublishVoteUpdate(ctx context.Context, pollID string, update *models.LiveVoteUpdate) error {
	channel := pollChannelKey(pollID)
	payload, err := json.Marshal(update)
	if err != nil {
		return err
	}
	return r.client.Publish(ctx, channel, payload).Err()
}

// PublishReaction broadcasts a live floating reaction emoji payload over Redis Pub/Sub.
func (r *RedisRepository) PublishReaction(ctx context.Context, pollID string, reaction *models.LiveReaction) error {
	channel := pollReactionsKey(pollID)
	payload, err := json.Marshal(reaction)
	if err != nil {
		return err
	}
	return r.client.Publish(ctx, channel, payload).Err()
}

// SubscribeVoteUpdates creates a subscription channel receiving real-time vote updates.
func (r *RedisRepository) SubscribeVoteUpdates(ctx context.Context, pollID string) (<-chan *models.LiveVoteUpdate, func(), error) {
	channel := pollChannelKey(pollID)
	pubsub := r.client.Subscribe(ctx, channel)
	outChan := make(chan *models.LiveVoteUpdate, 100)

	go func() {
		ch := pubsub.Channel()
		for msg := range ch {
			var update models.LiveVoteUpdate
			if err := json.Unmarshal([]byte(msg.Payload), &update); err == nil {
				select {
				case outChan <- &update:
				default:
				}
			}
		}
		close(outChan)
	}()

	cancelFunc := func() {
		_ = pubsub.Close()
	}

	return outChan, cancelFunc, nil
}

// SubscribeReactions creates a subscription channel receiving floating live emoji reactions.
func (r *RedisRepository) SubscribeReactions(ctx context.Context, pollID string) (<-chan *models.LiveReaction, func(), error) {
	channel := pollReactionsKey(pollID)
	pubsub := r.client.Subscribe(ctx, channel)
	outChan := make(chan *models.LiveReaction, 100)

	go func() {
		ch := pubsub.Channel()
		for msg := range ch {
			var rx models.LiveReaction
			if err := json.Unmarshal([]byte(msg.Payload), &rx); err == nil {
				select {
				case outChan <- &rx:
				default:
				}
			}
		}
		close(outChan)
	}()

	cancelFunc := func() {
		_ = pubsub.Close()
	}

	return outChan, cancelFunc, nil
}

// ResetPollVotes clears vote counters and voter sets for a poll.
func (r *RedisRepository) ResetPollVotes(ctx context.Context, pollID string) error {
	return r.client.Del(ctx, pollVotesKey(pollID), pollVotersKey(pollID)).Err()
}

// ============================================================================
// IN-MEMORY REALTIME FALLBACK REPOSITORY
// Emulates Redis atomic hashes, sets, and pub/sub channels safely in memory.
// ============================================================================

type InMemoryRealtimeRepository struct {
	mu           sync.RWMutex
	voteCounts   map[string]map[string]int64
	voters       map[string]map[string]bool
	voteSubChan  map[string][]chan *models.LiveVoteUpdate
	reactSubChan map[string][]chan *models.LiveReaction
}

func NewInMemoryRealtimeRepository() *InMemoryRealtimeRepository {
	log.Println("[Realtime] Initialized thread-safe In-Memory Realtime Pub/Sub & Counter engine")
	return &InMemoryRealtimeRepository{
		voteCounts:   make(map[string]map[string]int64),
		voters:       make(map[string]map[string]bool),
		voteSubChan:  make(map[string][]chan *models.LiveVoteUpdate),
		reactSubChan: make(map[string][]chan *models.LiveReaction),
	}
}

func (m *InMemoryRealtimeRepository) IncrementVoteCount(ctx context.Context, pollID string, optionIDs []string) (map[string]int64, int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.voteCounts[pollID]; !exists {
		m.voteCounts[pollID] = make(map[string]int64)
	}

	for _, optID := range optionIDs {
		m.voteCounts[pollID][optID]++
	}

	// Calculate copy and total
	copyCounts := make(map[string]int64)
	var total int64 = 0
	for k, v := range m.voteCounts[pollID] {
		copyCounts[k] = v
		total += v
	}
	return copyCounts, total, nil
}

func (m *InMemoryRealtimeRepository) GetVoteCounts(ctx context.Context, pollID string) (map[string]int64, int64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	copyCounts := make(map[string]int64)
	var total int64 = 0
	if counts, exists := m.voteCounts[pollID]; exists {
		for k, v := range counts {
			copyCounts[k] = v
			total += v
		}
	}
	return copyCounts, total, nil
}

func (m *InMemoryRealtimeRepository) RecordVoter(ctx context.Context, pollID string, voterIdentifier string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.voters[pollID]; !exists {
		m.voters[pollID] = make(map[string]bool)
	}
	m.voters[pollID][voterIdentifier] = true
	return nil
}

func (m *InMemoryRealtimeRepository) HasVoted(ctx context.Context, pollID string, voterIdentifier string) (bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if vMap, exists := m.voters[pollID]; exists {
		return vMap[voterIdentifier], nil
	}
	return false, nil
}

func (m *InMemoryRealtimeRepository) PublishVoteUpdate(ctx context.Context, pollID string, update *models.LiveVoteUpdate) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	subs := m.voteSubChan[pollID]
	for _, ch := range subs {
		select {
		case ch <- update:
		default:
		}
	}
	return nil
}

func (m *InMemoryRealtimeRepository) PublishReaction(ctx context.Context, pollID string, reaction *models.LiveReaction) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	subs := m.reactSubChan[pollID]
	for _, ch := range subs {
		select {
		case ch <- reaction:
		default:
		}
	}
	return nil
}

func (m *InMemoryRealtimeRepository) SubscribeVoteUpdates(ctx context.Context, pollID string) (<-chan *models.LiveVoteUpdate, func(), error) {
	m.mu.Lock()
	ch := make(chan *models.LiveVoteUpdate, 100)
	m.voteSubChan[pollID] = append(m.voteSubChan[pollID], ch)
	m.mu.Unlock()

	cancelFunc := func() {
		m.mu.Lock()
		defer m.mu.Unlock()
		subs := m.voteSubChan[pollID]
		for i, c := range subs {
			if c == ch {
				m.voteSubChan[pollID] = append(subs[:i], subs[i+1:]...)
				close(ch)
				break
			}
		}
	}

	return ch, cancelFunc, nil
}

func (m *InMemoryRealtimeRepository) SubscribeReactions(ctx context.Context, pollID string) (<-chan *models.LiveReaction, func(), error) {
	m.mu.Lock()
	ch := make(chan *models.LiveReaction, 100)
	m.reactSubChan[pollID] = append(m.reactSubChan[pollID], ch)
	m.mu.Unlock()

	cancelFunc := func() {
		m.mu.Lock()
		defer m.mu.Unlock()
		subs := m.reactSubChan[pollID]
		for i, c := range subs {
			if c == ch {
				m.reactSubChan[pollID] = append(subs[:i], subs[i+1:]...)
				close(ch)
				break
			}
		}
	}

	return ch, cancelFunc, nil
}

func (m *InMemoryRealtimeRepository) ResetPollVotes(ctx context.Context, pollID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.voteCounts, pollID)
	delete(m.voters, pollID)
	return nil
}
