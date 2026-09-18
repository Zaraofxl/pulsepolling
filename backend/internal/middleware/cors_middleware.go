package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// CORS (CROSS-ORIGIN RESOURCE SHARING) MIDDLEWARE
// Allows frontend single page applications (SPAs) on different origins/ports
// to securely communicate with the Go backend API.
// ============================================================================

// CORSMiddleware configures standard CORS headers and preflight handling.
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}

		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Header("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		// Handle HTTP OPTIONS preflight request immediately
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
