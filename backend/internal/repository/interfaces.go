package repository

import (
	"context"
	"pulsepoll-backend/internal/models"
)

// ============================================================================
// REPOSITORY INTERFACES
// Defines the data access contracts for persistence (MongoDB) and
// real-time fast in-memory operations (Redis).
// ============================================================================

// UserRepository defines database operations for user authentication and profiles.
type UserRepository interface {
	// CreateUser persists a newly registered user account
	CreateUser(ctx context.Context, user *models.User) error

	// FindByEmail retrieves a user by their unique email address
	FindByEmail(ctx context.Context, email string) (*models.User, error)

	// FindByID retrieves a user by their unique MongoDB Object ID
	FindByID(ctx context.Context, id string) (*models.User, error)
}

// PollRepository defines database operations for persistent poll management.
type PollRepository interface {
	// CreatePoll inserts a new poll into database
	CreatePoll(ctx context.Context, poll *models.Poll) error

	// GetPollByID retrieves a poll by its primary ID
	GetPollByID(ctx context.Context, id string) (*models.Poll, error)

	// GetPollByCode retrieves a poll by its short shareable 6-char code
	GetPollByCode(ctx context.Context, code string) (*models.Poll, error)

	// ListPollsByCreator retrieves all polls created by a specific user
	ListPollsByCreator(ctx context.Context, creatorID string) ([]*models.Poll, error)

	// UpdatePoll updates poll title, description, or status
	UpdatePoll(ctx context.Context, poll *models.Poll) error

	// UpdateOptionVotes updates persistent vote counts in database
	UpdateOptionVotes(ctx context.Context, pollID string, optionCounts map[string]int64, totalVotes int64) error

	// DeletePoll removes a poll document
	DeletePoll(ctx context.Context, id string, creatorID string) error

	// RecordVoteAuditLog saves an immutable vote log document for auditing
	RecordVoteAuditLog(ctx context.Context, log *models.VoteLog) error

	// GetVoteLogs retrieves all audit logs for a poll (for analytics/export)
	GetVoteLogs(ctx context.Context, pollID string) ([]*models.VoteLog, error)
}

// RealtimeRepository defines high-throughput Redis operations for live polling.
type RealtimeRepository interface {
	// IncrementVoteCount atomically increments vote count for specific options in Redis hash (HINCRBY)
	IncrementVoteCount(ctx context.Context, pollID string, optionIDs []string) (map[string]int64, int64, error)

	// GetVoteCounts retrieves the live sub-millisecond tally from Redis hash
	GetVoteCounts(ctx context.Context, pollID string) (map[string]int64, int64, error)

	// RecordVoter marks a voter fingerprint/IP as having voted on a poll (SADD)
	RecordVoter(ctx context.Context, pollID string, voterIdentifier string) error

	// HasVoted checks if a voter fingerprint/IP has already voted on this poll (SISMEMBER)
	HasVoted(ctx context.Context, pollID string, voterIdentifier string) (bool, error)

	// PublishVoteUpdate sends live vote counts to Redis Pub/Sub channel
	PublishVoteUpdate(ctx context.Context, pollID string, update *models.LiveVoteUpdate) error

	// PublishReaction sends a floating live reaction emoji to Redis Pub/Sub channel
	PublishReaction(ctx context.Context, pollID string, reaction *models.LiveReaction) error

	// SubscribeVoteUpdates opens a Pub/Sub listener for a specific poll
	SubscribeVoteUpdates(ctx context.Context, pollID string) (<-chan *models.LiveVoteUpdate, func(), error)

	// SubscribeReactions opens a Pub/Sub listener for floating emoji reactions
	SubscribeReactions(ctx context.Context, pollID string) (<-chan *models.LiveReaction, func(), error)

	// ResetPollVotes clears Redis counters and deduplication sets for a poll
	ResetPollVotes(ctx context.Context, pollID string) error
}
