package services

import (
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"pulsepoll-backend/internal/models"
	"pulsepoll-backend/internal/repository"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ============================================================================
// POLL MANAGEMENT SERVICE
// Implements poll business logic: creation with randomized short codes,
// option color palette assignment, status toggling, CSV export, and deletion.
// ============================================================================

// Pre-defined modern vibrant colors for poll options in UI
var defaultOptionColors = []string{
	"#6366f1", // Indigo
	"#10b981", // Emerald
	"#f59e0b", // Amber
	"#ec4899", // Pink
	"#06b6d4", // Cyan
	"#8b5cf6", // Purple
	"#f97316", // Orange
	"#14b8a6", // Teal
	"#ef4444", // Red
	"#3b82f6", // Blue
}

// PollService handles poll operations.
type PollService struct {
	pollRepo     repository.PollRepository
	realtimeRepo repository.RealtimeRepository
	userRepo     repository.UserRepository
}

// NewPollService constructs a PollService instance.
func NewPollService(pollRepo repository.PollRepository, realtimeRepo repository.RealtimeRepository, userRepo repository.UserRepository) *PollService {
	return &PollService{
		pollRepo:     pollRepo,
		realtimeRepo: realtimeRepo,
		userRepo:     userRepo,
	}
}

// generatePollCode generates a short 6-character uppercase alphanumeric code (e.g. "PL-8429").
func generatePollCode() string {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 4)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return fmt.Sprintf("PL-%s", string(b))
}

// CreatePoll validates and creates a new poll.
func (s *PollService) CreatePoll(ctx context.Context, creatorID string, req *models.CreatePollRequest) (*models.Poll, error) {
	// Step 1: Validate minimum 2 options
	if len(req.Options) < 2 {
		return nil, errors.New("a poll must have at least 2 options")
	}

	creatorObjID, err := primitive.ObjectIDFromHex(creatorID)
	if err != nil {
		return nil, errors.New("invalid creator ID")
	}

	// Fetch creator name for display
	creatorName := "Host"
	if user, err := s.userRepo.FindByID(ctx, creatorID); err == nil {
		creatorName = user.Name
	}

	// Step 2: Build Option entities with unique IDs and distinct colors
	options := make([]models.PollOption, len(req.Options))
	for i, optText := range req.Options {
		color := defaultOptionColors[i%len(defaultOptionColors)]
		if i < len(req.Colors) && req.Colors[i] != "" {
			color = req.Colors[i]
		}
		options[i] = models.PollOption{
			ID:    fmt.Sprintf("opt_%d", i+1),
			Text:  strings.TrimSpace(optText),
			Color: color,
			Votes: 0,
		}
	}

	// Step 3: Construct Poll model
	poll := &models.Poll{
		ID:          primitive.NewObjectID(),
		Code:        generatePollCode(),
		Title:       strings.TrimSpace(req.Title),
		Description: strings.TrimSpace(req.Description),
		CreatorID:   creatorObjID,
		CreatorName: creatorName,
		Options:     options,
		Settings:    req.Settings,
		IsActive:    true,
		TotalVotes:  0,
	}

	// Step 4: Persist in MongoDB
	if err := s.pollRepo.CreatePoll(ctx, poll); err != nil {
		return nil, fmt.Errorf("failed to create poll: %w", err)
	}

	return poll, nil
}

// GetPoll retrieves a poll by its ObjectID or 6-char shareable Code, enriched with live Redis counts.
func (s *PollService) GetPoll(ctx context.Context, identifier string) (*models.Poll, error) {
	var poll *models.Poll
	var err error

	// Check if identifier is a MongoDB ObjectID hex string (24 characters)
	if len(identifier) == 24 {
		poll, err = s.pollRepo.GetPollByID(ctx, identifier)
	}

	// If not found or identifier is short code, search by code
	if poll == nil || err != nil {
		poll, err = s.pollRepo.GetPollByCode(ctx, strings.ToUpper(identifier))
	}

	if err != nil || poll == nil {
		return nil, errors.New("poll not found")
	}

	// Enrich option votes with real-time Redis in-memory cache if available
	liveCounts, total, err := s.realtimeRepo.GetVoteCounts(ctx, poll.ID.Hex())
	if err == nil && total > 0 {
		for i := range poll.Options {
			if count, found := liveCounts[poll.Options[i].ID]; found {
				poll.Options[i].Votes = count
			}
		}
		poll.TotalVotes = total
	}

	return poll, nil
}

// ListCreatorPolls retrieves all polls created by a user.
func (s *PollService) ListCreatorPolls(ctx context.Context, creatorID string) ([]*models.Poll, error) {
	polls, err := s.pollRepo.ListPollsByCreator(ctx, creatorID)
	if err != nil {
		return nil, err
	}

	// Overlay real-time Redis vote counts for all polls
	for _, poll := range polls {
		liveCounts, total, err := s.realtimeRepo.GetVoteCounts(ctx, poll.ID.Hex())
		if err == nil && total > 0 {
			for i := range poll.Options {
				if count, found := liveCounts[poll.Options[i].ID]; found {
					poll.Options[i].Votes = count
				}
			}
			poll.TotalVotes = total
		}
	}

	return polls, nil
}

// UpdatePoll allows creator to edit poll details, pause/resume voting, or update rules.
func (s *PollService) UpdatePoll(ctx context.Context, pollID string, creatorID string, req *models.UpdatePollRequest) (*models.Poll, error) {
	poll, err := s.pollRepo.GetPollByID(ctx, pollID)
	if err != nil {
		return nil, errors.New("poll not found")
	}

	if poll.CreatorID.Hex() != creatorID {
		return nil, errors.New("permission denied: you are not the creator of this poll")
	}

	if req.Title != "" {
		poll.Title = strings.TrimSpace(req.Title)
	}
	if req.Description != "" {
		poll.Description = strings.TrimSpace(req.Description)
	}
	if req.IsActive != nil {
		poll.IsActive = *req.IsActive
	}
	if req.Settings != nil {
		poll.Settings = *req.Settings
	}

	if err := s.pollRepo.UpdatePoll(ctx, poll); err != nil {
		return nil, fmt.Errorf("failed to update poll: %w", err)
	}

	return poll, nil
}

// DeletePoll removes a poll and purges its Redis memory keys.
func (s *PollService) DeletePoll(ctx context.Context, pollID string, creatorID string) error {
	if err := s.pollRepo.DeletePoll(ctx, pollID, creatorID); err != nil {
		return err
	}
	_ = s.realtimeRepo.ResetPollVotes(ctx, pollID)
	return nil
}

// ResetPollVotes clears all votes from Redis and MongoDB while keeping poll options intact.
func (s *PollService) ResetPollVotes(ctx context.Context, pollID string, creatorID string) error {
	poll, err := s.pollRepo.GetPollByID(ctx, pollID)
	if err != nil {
		return errors.New("poll not found")
	}
	if poll.CreatorID.Hex() != creatorID {
		return errors.New("permission denied")
	}

	// 1. Reset Redis cache & voter deduplication sets
	_ = s.realtimeRepo.ResetPollVotes(ctx, pollID)

	// 2. Reset database option counts
	emptyCounts := make(map[string]int64)
	for _, opt := range poll.Options {
		emptyCounts[opt.ID] = 0
	}
	_ = s.pollRepo.UpdateOptionVotes(ctx, pollID, emptyCounts, 0)

	// 3. Broadcast reset event over Redis Pub/Sub
	_ = s.realtimeRepo.PublishVoteUpdate(ctx, pollID, &models.LiveVoteUpdate{
		PollID:       pollID,
		TotalVotes:   0,
		OptionCounts: emptyCounts,
		Percentages:  make(map[string]float64),
		LastVoteAt:   time.Now().UTC(),
		VoterCount:   0,
	})

	return nil
}

// ExportPollCSV generates a downloadable CSV byte buffer of poll results and audit log records.
func (s *PollService) ExportPollCSV(ctx context.Context, pollID string) ([]byte, error) {
	poll, err := s.GetPoll(ctx, pollID)
	if err != nil {
		return nil, err
	}

	logs, _ := s.pollRepo.GetVoteLogs(ctx, pollID)

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// Section 1: Poll Overview
	_ = writer.Write([]string{"PULSEPOLL EXPORT REPORT"})
	_ = writer.Write([]string{"Poll Title", poll.Title})
	_ = writer.Write([]string{"Share Code", poll.Code})
	_ = writer.Write([]string{"Total Votes", strconv.FormatInt(poll.TotalVotes, 10)})
	_ = writer.Write([]string{"Created At", poll.CreatedAt.Format(time.RFC1123)})
	_ = writer.Write([]string{""}) // Blank line

	// Section 2: Option Tallies
	_ = writer.Write([]string{"Option ID", "Option Text", "Vote Count", "Percentage"})
	for _, opt := range poll.Options {
		pct := 0.0
		if poll.TotalVotes > 0 {
			pct = (float64(opt.Votes) / float64(poll.TotalVotes)) * 100
		}
		_ = writer.Write([]string{
			opt.ID,
			opt.Text,
			strconv.FormatInt(opt.Votes, 10),
			fmt.Sprintf("%.1f%%", pct),
		})
	}
	_ = writer.Write([]string{""}) // Blank line

	// Section 3: Vote Audit Logs
	_ = writer.Write([]string{"Audit Log ID", "Selected Options", "Voter Name", "Voter IP", "Timestamp"})
	for _, logItem := range logs {
		_ = writer.Write([]string{
			logItem.ID.Hex(),
			strings.Join(logItem.OptionIDs, ", "),
			logItem.VoterName,
			logItem.VoterIP,
			logItem.CreatedAt.Format(time.RFC3339),
		})
	}

	writer.Flush()
	return buf.Bytes(), nil
}
