package handlers

import (
	"pulsepoll-backend/internal/realtime"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// WEBSOCKET HANDLER
// Upgrades HTTP connection to bidirectional WebSocket stream for live updates.
// ============================================================================

type WSHandler struct {
	hub *realtime.Hub
}

// NewWSHandler constructs a WSHandler instance.
func NewWSHandler(hub *realtime.Hub) *WSHandler {
	return &WSHandler{hub: hub}
}

// HandleWebSocket upgrades connection and hooks into realtime hub.
// GET /ws/polls/:id
func (h *WSHandler) HandleWebSocket(c *gin.Context) {
	pollID := c.Param("id")
	if pollID == "" {
		c.JSON(400, gin.H{"error": "Poll ID parameter is required"})
		return
	}

	h.hub.ServeWS(c.Writer, c.Request, pollID)
}
