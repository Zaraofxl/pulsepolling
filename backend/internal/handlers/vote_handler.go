package handlers

import (
	"net/http"

	"pulsepoll-backend/internal/models"
	"pulsepoll-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// VOTE & INTERACTION HTTP HANDLERS
// Ingests audience votes, performs client fingerprint checks, and handles
// floating live emoji reactions.
// ============================================================================

type VoteHandler struct {
	voteService *services.VoteService
}

// NewVoteHandler constructs a VoteHandler instance.
func NewVoteHandler(voteService *services.VoteService) *VoteHandler {
	return &VoteHandler{voteService: voteService}
}

// CastVote handles submitting a vote for a poll.
// POST /api/polls/:id/vote (Public)
func (h *VoteHandler) CastVote(c *gin.Context) {
	pollID := c.Param("id")
	if pollID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Poll ID is required"})
		return
	}

	var req models.CastVoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid vote request payload. Please select at least one option and ensure voter fingerprint is present.",
			"details": err.Error(),
		})
		return
	}

	clientIP := c.ClientIP()
	userAgent := c.Request.UserAgent()

	update, err := h.voteService.CastVote(c.Request.Context(), pollID, clientIP, userAgent, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Vote registered successfully",
		"data":    update,
	})
}

// CheckIfVoted checks if the voter has already voted on this poll based on fingerprint.
// GET /api/polls/:id/voted?fp=<fingerprint> (Public)
func (h *VoteHandler) CheckIfVoted(c *gin.Context) {
	pollID := c.Param("id")
	fp := c.Query("fp")

	if pollID == "" || fp == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Poll ID and fingerprint (fp) query parameter are required"})
		return
	}

	hasVoted, err := h.voteService.CheckIfVoted(c.Request.Context(), pollID, fp)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"has_voted": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"has_voted": hasVoted,
	})
}

// SendReaction broadcasts a live floating reaction emoji to all spectators.
// POST /api/polls/:id/reactions (Public)
func (h *VoteHandler) SendReaction(c *gin.Context) {
	pollID := c.Param("id")
	if pollID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Poll ID is required"})
		return
	}

	var req struct {
		Emoji  string `json:"emoji" binding:"required"`
		Sender string `json:"sender"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Emoji is required"})
		return
	}

	if err := h.voteService.SendReaction(c.Request.Context(), pollID, req.Emoji, req.Sender); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Reaction broadcasted",
	})
}
