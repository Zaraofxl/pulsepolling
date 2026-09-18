package handlers

import (
	"net/http"

	"pulsepoll-backend/internal/models"
	"pulsepoll-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// AUTHENTICATION HTTP HANDLERS
// Handles user registration, credentials authentication, and profile endpoints.
// ============================================================================

type AuthHandler struct {
	authService *services.AuthService
}

// NewAuthHandler constructs an AuthHandler instance.
func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// Register creates a new user account.
// POST /api/auth/register
func (h *AuthHandler) Register(c *gin.Context) {
	var req models.UserRegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid registration request payload. Please ensure name, email, and password (min 6 chars) are valid.",
			"details": err.Error(),
		})
		return
	}

	res, err := h.authService.Register(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Account created successfully",
		"data":    res,
	})
}

// Login authenticates existing user credentials and returns a JWT.
// POST /api/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.UserLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Please provide a valid email and password.",
			"details": err.Error(),
		})
		return
	}

	res, err := h.authService.Login(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"data":    res,
	})
}

// GetMe returns profile information for the authenticated user.
// GET /api/auth/me (Protected)
func (h *AuthHandler) GetMe(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized session"})
		return
	}

	profile, err := h.authService.GetUserProfile(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": profile,
	})
}
