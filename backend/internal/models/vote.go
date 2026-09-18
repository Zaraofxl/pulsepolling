package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ============================================================================
// VOTE MODEL & AUDIT LOGS
// Represents incoming vote payloads and immutable audit log records.
// ============================================================================

// CastVoteRequest represents the JSON payload sent by an audience member when casting a vote.
type CastVoteRequest struct {
	// OptionIDs: Array of option IDs selected by the voter (1 ID for single choice, multiple for multi-choice)
	OptionIDs []string `json:"option_ids" binding:"required,min=1"`

	// VoterFingerprint: Client-generated unique browser/device fingerprint token to prevent spam
	VoterFingerprint string `json:"voter_fingerprint" binding:"required"`

	// VoterName: Optional name provided by the voter if required or requested
	VoterName string `json:"voter_name"`
}

// VoteLog represents the persistent, immutable audit record written to MongoDB for analytics and history.
type VoteLog struct {
	// ID: Unique MongoDB Object ID for the vote record
	ID primitive.ObjectID `bson:"_id,omitempty" json:"id"`

	// PollID: Reference to the Poll being voted on
	PollID primitive.ObjectID `bson:"poll_id" json:"poll_id"`

	// OptionIDs: The choices selected in this vote
	OptionIDs []string `bson:"option_ids" json:"option_ids"`

	// VoterFingerprint: Device fingerprint hash
	VoterFingerprint string `bson:"voter_fingerprint" json:"voter_fingerprint"`

	// VoterIP: Client IP address (used for rate-limiting and duplicate prevention)
	VoterIP string `bson:"voter_ip" json:"voter_ip"`

	// UserAgent: Client browser user agent string
	UserAgent string `bson:"user_agent" json:"user_agent"`

	// VoterName: Display name of the voter if provided
	VoterName string `bson:"voter_name,omitempty" json:"voter_name,omitempty"`

	// CreatedAt: UTC timestamp when the vote was registered
	CreatedAt time.Time `bson:"created_at" json:"created_at"`
}

// VoteCheckResponse is returned to check if a specific client has already voted on a poll.
type VoteCheckResponse struct {
	HasVoted  bool     `json:"has_voted"`
	OptionIDs []string `json:"option_ids,omitempty"`
}
