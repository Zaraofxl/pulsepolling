package handlers

import (
	"fmt"
	"net/http"
	"time"

	"pulsepoll-backend/internal/models"
	"pulsepoll-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// POLL HTTP HANDLERS
// Handles CRUD operations, state toggling, and CSV exports for polls.
// ============================================================================

type PollHandler struct {
	pollService *services.PollService
}

// NewPollHandler constructs a PollHandler instance.
func NewPollHandler(pollService *services.PollService) *PollHandler {
	return &PollHandler{pollService: pollService}
}

// CreatePoll handles new poll creation by authenticated users.
// POST /api/polls (Protected)
func (h *PollHandler) CreatePoll(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: please log in"})
		return
	}

	var req models.CreatePollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid poll data. A title and at least 2 options are required.",
			"details": err.Error(),
		})
		return
	}

	poll, err := h.pollService.CreatePoll(c.Request.Context(), userID.(string), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Poll created successfully",
		"data":    poll,
	})
}

// GetPoll retrieves public details of a poll by ID or 6-character Code.
// GET /api/polls/:id (Public)
func (h *PollHandler) GetPoll(c *gin.Context) {
	identifier := c.Param("id")
	if identifier == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Poll identifier is required"})
		return
	}

	poll, err := h.pollService.GetPoll(c.Request.Context(), identifier)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found or invalid code"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": poll,
	})
}

// ListMyPolls returns all polls created by the authenticated user.
// GET /api/polls/my (Protected)
func (h *PollHandler) ListMyPolls(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	polls, err := h.pollService.ListCreatorPolls(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": polls,
	})
}

// UpdatePoll updates poll metadata, pause/active state, or expiration settings.
// PUT /api/polls/:id (Protected)
func (h *PollHandler) UpdatePoll(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	pollID := c.Param("id")
	var req models.UpdatePollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid update payload", "details": err.Error()})
		return
	}

	poll, err := h.pollService.UpdatePoll(c.Request.Context(), pollID, userID.(string), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Poll updated successfully",
		"data":    poll,
	})
}

// DeletePoll permanently deletes a poll and its logs.
// DELETE /api/polls/:id (Protected)
func (h *PollHandler) DeletePoll(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	pollID := c.Param("id")
	if err := h.pollService.DeletePoll(c.Request.Context(), pollID, userID.(string)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Poll deleted successfully",
	})
}

// ResetPoll clears all votes from Redis and DB.
// POST /api/polls/:id/reset (Protected)
func (h *PollHandler) ResetPoll(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	pollID := c.Param("id")
	if err := h.pollService.ResetPollVotes(c.Request.Context(), pollID, userID.(string)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Poll votes reset to zero successfully",
	})
}

// ExportCSV downloads poll results and logs as a CSV file.
// GET /api/polls/:id/export.csv (Protected)
func (h *PollHandler) ExportCSV(c *gin.Context) {
	pollID := c.Param("id")
	csvData, err := h.pollService.ExportPollCSV(c.Request.Context(), pollID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	fileName := fmt.Sprintf("poll_%s_results_%d.csv", pollID, time.Now().Unix())
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", fileName))
	c.Data(http.StatusOK, "text/csv", csvData)
}
