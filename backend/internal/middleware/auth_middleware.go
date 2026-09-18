package middleware

import (
	"net/http"
	"strings"

	"pulsepoll-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// JWT AUTHENTICATION MIDDLEWARE
// Intercepts protected API endpoints, verifies Bearer tokens, and attaches
// user claims to the Gin request context.
// ============================================================================

// AuthMiddleware inspects the "Authorization: Bearer <token>" header.
func AuthMiddleware(authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Step 1: Extract Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authentication required. Please log in.",
			})
			c.Abort()
			return
		}

		// Step 2: Parse "Bearer <token>" prefix
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid Authorization header format. Format must be 'Bearer <token>'.",
			})
			c.Abort()
			return
		}

		tokenString := strings.TrimSpace(parts[1])

		// Step 3: Cryptographically validate token signature and expiration
		claims, err := authService.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Session expired or invalid token. Please log in again.",
			})
			c.Abort()
			return
		}

		// Step 4: Inject user claims into Gin context for downstream handlers
		c.Set("userID", claims.UserID)
		c.Set("userEmail", claims.Email)
		c.Set("userName", claims.Name)

		c.Next()
	}
}
