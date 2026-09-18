package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"pulsepoll-backend/internal/models"
	"pulsepoll-backend/internal/repository"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ============================================================================
// VOTE INGESTION & REALTIME DISPATCH SERVICE
// High-throughput vote processing engine that executes atomic Redis increments,
// validates deduplication rules, broadcasts live updates over Redis Pub/Sub,
// and asynchronously persists audit records to MongoDB.
// ============================================================================

type VoteService struct {
	pollRepo     repository.PollRepository
	realtimeRepo repository.RealtimeRepository
}

// NewVoteService constructs a VoteService instance.
func NewVoteService(pollRepo repository.PollRepository, realtimeRepo repository.RealtimeRepository) *VoteService {
	return &VoteService{
		pollRepo:     pollRepo,
		realtimeRepo: realtimeRepo,
	}
}

// CastVote processes an incoming voter submission with strict server-side validation.
func (s *VoteService) CastVote(ctx context.Context, pollID string, clientIP string, userAgent string, req *models.CastVoteRequest) (*models.LiveVoteUpdate, error) {
	// ------------------------------------------------------------------------
	// STEP 1: Fetch and validate the Poll
	// ------------------------------------------------------------------------
	poll, err := s.pollRepo.GetPollByID(ctx, pollID)
	if err != nil {
		return nil, errors.New("poll not found")
	}

	// Verify poll active state
	if !poll.IsActive {
		return nil, errors.New("voting for this poll has been paused or closed by the host")
	}

	// Verify poll expiration date
	if poll.Settings.ExpiresAt != nil && time.Now().UTC().After(*poll.Settings.ExpiresAt) {
		return nil, errors.New("this poll has expired and is no longer accepting votes")
	}

	// ------------------------------------------------------------------------
	// STEP 2: Validate chosen options against poll definition
	// ------------------------------------------------------------------------
	if len(req.OptionIDs) == 0 {
		return nil, errors.New("at least one option must be selected")
	}

	if !poll.Settings.AllowMultiple && len(req.OptionIDs) > 1 {
		return nil, errors.New("this poll allows only a single choice")
	}

	// Map valid option IDs for fast membership checking
	validOptionIDs := make(map[string]bool)
	for _, opt := range poll.Options {
		validOptionIDs[opt.ID] = true
	}

	for _, chosenOptID := range req.OptionIDs {
		if !validOptionIDs[chosenOptID] {
			return nil, fmt.Errorf("invalid option ID selected: %s", chosenOptID)
		}
	}

	// Verify demographic requirements
	if poll.Settings.RequireVoterName && strings.TrimSpace(req.VoterName) == "" {
		return nil, errors.New("your name is required to participate in this poll")
	}

	if poll.Settings.RequireGender && strings.TrimSpace(req.VoterGender) == "" {
		return nil, errors.New("your gender is required to participate in this poll")
	}

	if poll.Settings.RequirePlace && strings.TrimSpace(req.VoterPlace) == "" {
		return nil, errors.New("your place / location is required to participate in this poll")
	}

	// ------------------------------------------------------------------------
	// STEP 3: Deduplication & Anti-Spam Check via Redis Sets
	// ------------------------------------------------------------------------
	voterKey := fmt.Sprintf("fp:%s", req.VoterFingerprint)
	hasVoted, err := s.realtimeRepo.HasVoted(ctx, pollID, voterKey)
	if err == nil && hasVoted {
		return nil, errors.New("you have already cast your vote in this poll")
	}

	// Register voter in Redis Set immediately
	_ = s.realtimeRepo.RecordVoter(ctx, pollID, voterKey)
	if clientIP != "" {
		_ = s.realtimeRepo.RecordVoter(ctx, pollID, fmt.Sprintf("ip:%s", clientIP))
	}

	// ------------------------------------------------------------------------
	// STEP 4: Atomic Redis Increment (HINCRBY)
	// ------------------------------------------------------------------------
	updatedCounts, totalVotes, err := s.realtimeRepo.IncrementVoteCount(ctx, pollID, req.OptionIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to record vote counts in realtime engine: %w", err)
	}

	// Calculate percentages for each option
	percentages := make(map[string]float64)
	for optID, count := range updatedCounts {
		if totalVotes > 0 {
			percentages[optID] = (float64(count) / float64(totalVotes)) * 100
		} else {
			percentages[optID] = 0.0
		}
	}

	liveUpdate := &models.LiveVoteUpdate{
		PollID:       pollID,
		TotalVotes:   totalVotes,
		OptionCounts: updatedCounts,
		Percentages:  percentages,
		LastVoteAt:   time.Now().UTC(),
		VoterCount:   totalVotes,
	}

	// ------------------------------------------------------------------------
	// STEP 5: Broadcast Live Update over Redis Pub/Sub
	// ------------------------------------------------------------------------
	go func() {
		if err := s.realtimeRepo.PublishVoteUpdate(context.Background(), pollID, liveUpdate); err != nil {
			log.Printf("[Realtime] Warning: failed to publish vote update: %v", err)
		}
	}()

	// ------------------------------------------------------------------------
	// STEP 6: Asynchronous Write-Through to MongoDB for Audit & Persistence
	// ------------------------------------------------------------------------
	go func() {
		pollObjID, _ := primitive.ObjectIDFromHex(pollID)
		auditLog := &models.VoteLog{
			PollID:           pollObjID,
			OptionIDs:        req.OptionIDs,
			VoterFingerprint: req.VoterFingerprint,
			VoterIP:          clientIP,
			UserAgent:        userAgent,
			VoterName:        strings.TrimSpace(req.VoterName),
			VoterGender:      strings.TrimSpace(req.VoterGender),
			VoterPlace:       strings.TrimSpace(req.VoterPlace),
		}

		// Persist audit record in MongoDB
		if err := s.pollRepo.RecordVoteAuditLog(context.Background(), auditLog); err != nil {
			log.Printf("[MongoDB] Audit log error: %v", err)
		}

		// Update persistent option tallies in MongoDB
		if err := s.pollRepo.UpdateOptionVotes(context.Background(), pollID, updatedCounts, totalVotes); err != nil {
			log.Printf("[MongoDB] UpdateOptionVotes sync error: %v", err)
		}
	}()

	return liveUpdate, nil
}

// SendReaction broadcasts a live floating reaction emoji (e.g. ❤️, 🔥, 🎉) over Redis Pub/Sub.
func (s *VoteService) SendReaction(ctx context.Context, pollID string, emoji string, sender string) error {
	reaction := &models.LiveReaction{
		PollID:    pollID,
		Emoji:     emoji,
		Sender:    sender,
		Timestamp: time.Now().UTC(),
	}

	return s.realtimeRepo.PublishReaction(ctx, pollID, reaction)
}

// CheckIfVoted inspects Redis set to verify if this browser client has voted.
func (s *VoteService) CheckIfVoted(ctx context.Context, pollID string, fingerprint string) (bool, error) {
	voterKey := fmt.Sprintf("fp:%s", fingerprint)
	return s.realtimeRepo.HasVoted(ctx, pollID, voterKey)
}
