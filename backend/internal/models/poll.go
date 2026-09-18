package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ============================================================================
// POLL & OPTION MODELS
// Defines the core data structures for live interactive polls, choices,
// settings, and real-time broadcast payloads.
// ============================================================================

// PollOption represents an individual choice within a poll.
type PollOption struct {
	// ID: Unique identifier for the option within the poll (e.g. "opt_1", "opt_2")
	ID string `bson:"id" json:"id"`

	// Text: The human-readable label/answer for this option
	Text string `bson:"text" json:"text" binding:"required,min=1,max=200"`

	// Color: Optional custom hex/accent color for chart visualization (e.g. "#6366f1")
	Color string `bson:"color" json:"color"`

	// Votes: Current persistent vote count stored in database
	Votes int64 `bson:"votes" json:"votes"`
}

// PollSettings holds configurable behavior flags for a poll.
type PollSettings struct {
	// AllowMultiple: If true, voters can select more than one option
	AllowMultiple bool `bson:"allow_multiple" json:"allow_multiple"`

	// RequireVoterName: If true, voters are prompted to supply their name
	RequireVoterName bool `bson:"require_voter_name" json:"require_voter_name"`

	// ShowResultsImmediately: Whether viewers see live percentages before or only after voting
	ShowResultsImmediately bool `bson:"show_results_immediately" json:"show_results_immediately"`

	// ExpiresAt: Optional expiration timestamp after which voting is automatically closed
	ExpiresAt *time.Time `bson:"expires_at,omitempty" json:"expires_at,omitempty"`
}

// Poll represents the complete poll document saved in MongoDB.
type Poll struct {
	// ID: MongoDB ObjectID primary key
	ID primitive.ObjectID `bson:"_id,omitempty" json:"id"`

	// Code: Short 6-character alphanumeric code for audience quick-join (e.g. "PL-7492")
	Code string `bson:"code" json:"code"`

	// Title: The main question or topic being voted on
	Title string `bson:"title" json:"title" binding:"required,min=3,max=300"`

	// Description: Optional background context or instructions for voters
	Description string `bson:"description" json:"description"`

	// CreatorID: The ID of the authenticated user who owns this poll
	CreatorID primitive.ObjectID `bson:"creator_id" json:"creator_id"`

	// CreatorName: Cached display name of the creator for fast rendering
	CreatorName string `bson:"creator_name" json:"creator_name"`

	// Options: List of choices available for voters
	Options []PollOption `bson:"options" json:"options" binding:"required,min=2,dive"`

	// Settings: Configuration options for poll rules and behavior
	Settings PollSettings `bson:"settings" json:"settings"`

	// IsActive: Master toggle allowing creator to pause or resume voting
	IsActive bool `bson:"is_active" json:"is_active"`

	// TotalVotes: Total count of votes submitted across all options
	TotalVotes int64 `bson:"total_votes" json:"total_votes"`

	// CreatedAt: UTC timestamp when the poll was created
	CreatedAt time.Time `bson:"created_at" json:"created_at"`

	// UpdatedAt: UTC timestamp when the poll was last updated
	UpdatedAt time.Time `bson:"updated_at" json:"updated_at"`
}

// CreatePollRequest represents client payload for creating a new poll.
type CreatePollRequest struct {
	Title       string       `json:"title" binding:"required,min=3,max=300"`
	Description string       `json:"description"`
	Options     []string     `json:"options" binding:"required,min=2,max=10"`
	Colors      []string     `json:"colors"`
	Settings    PollSettings `json:"settings"`
}

// UpdatePollRequest represents client payload for modifying poll status or settings.
type UpdatePollRequest struct {
	Title       string        `json:"title" binding:"omitempty,min=3,max=300"`
	Description string        `json:"description"`
	IsActive    *bool         `json:"is_active"`
	Settings    *PollSettings `json:"settings"`
}

// LiveVoteUpdate represents the real-time websocket & Redis payload sent to all connected viewers.
type LiveVoteUpdate struct {
	PollID       string           `json:"poll_id"`
	TotalVotes   int64            `json:"total_votes"`
	OptionCounts map[string]int64 `json:"option_counts"`
	Percentages  map[string]float64 `json:"percentages"`
	LastVoteAt   time.Time        `json:"last_vote_at"`
	VoterCount   int64            `json:"voter_count"`
}

// LiveReaction represents a transient floating emoji sent by audience viewers (e.g. ❤️, 🎉, 🔥, 🚀).
type LiveReaction struct {
	PollID    string    `json:"poll_id"`
	Emoji     string    `json:"emoji"`
	Sender    string    `json:"sender,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}
