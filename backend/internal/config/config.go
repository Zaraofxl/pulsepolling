package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// ============================================================================
// APPLICATION CONFIGURATION
// Loads and parses environment variables with secure fallback defaults.
// ============================================================================

// Config holds all server, database, cache, and authentication settings.
type Config struct {
	// ServerPort: Port on which the Gin HTTP & WebSocket server will listen (e.g. 8080)
	ServerPort string

	// MongoURI: Connection URI string for MongoDB database instance
	MongoURI string

	// MongoDBName: Name of the MongoDB database schema
	MongoDBName string

	// RedisAddr: Address:port host string for Redis (e.g. "localhost:6379")
	RedisAddr string

	// RedisPassword: Password authentication for Redis instance (if required)
	RedisPassword string

	// RedisDB: Redis logical database index (default: 0)
	RedisDB int

	// JWTSecret: Cryptographic secret key used to sign and verify authentication JWTs
	JWTSecret string

	// JWTExpiryHours: Number of hours before generated auth tokens expire
	JWTExpiryHours int

	// ClientOrigin: Permitted frontend origins for Cross-Origin Resource Sharing (CORS)
	ClientOrigin string

	// FallbackMode: If true, automatically falls back to safe in-memory repositories if Redis/Mongo are unreachable
	FallbackMode bool
}

// LoadConfig reads configuration values from .env file and OS environment variables.
// If any value is omitted, production-grade or sensible defaults are applied.
func LoadConfig() *Config {
	// Step 1: Attempt to load from local .env file (non-fatal if file is not found)
	if err := godotenv.Load(); err != nil {
		log.Println("[Config] No .env file found, using system environment variables and default values")
	}

	// Step 2: Extract port or default to 8080
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Step 3: Extract MongoDB configuration
	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}

	mongoDBName := os.Getenv("MONGODB_NAME")
	if mongoDBName == "" {
		mongoDBName = "pulsepoll_db"
	}

	// Step 4: Extract Redis configuration
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}

	redisPassword := os.Getenv("REDIS_PASSWORD")

	redisDB := 0
	if dbStr := os.Getenv("REDIS_DB"); dbStr != "" {
		if parsedDB, err := strconv.Atoi(dbStr); err == nil {
			redisDB = parsedDB
		}
	}

	// Step 5: Extract JWT Secret (with a robust fallback for development)
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "pulsepoll-ultra-secure-jwt-secret-key-2026"
	}

	jwtExpiryHours := 72 // 3 days default
	if expStr := os.Getenv("JWT_EXPIRY_HOURS"); expStr != "" {
		if parsedExp, err := strconv.Atoi(expStr); err == nil {
			jwtExpiryHours = parsedExp
		}
	}

	// Step 6: Extract allowed frontend CORS origin
	clientOrigin := os.Getenv("CLIENT_ORIGIN")
	if clientOrigin == "" {
		clientOrigin = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
	}

	// Step 7: Fallback mode setting
	fallbackMode := true
	if fbStr := os.Getenv("FALLBACK_MODE"); fbStr == "false" {
		fallbackMode = false
	}

	return &Config{
		ServerPort:     port,
		MongoURI:       mongoURI,
		MongoDBName:    mongoDBName,
		RedisAddr:      redisAddr,
		RedisPassword:  redisPassword,
		RedisDB:        redisDB,
		JWTSecret:      jwtSecret,
		JWTExpiryHours: jwtExpiryHours,
		ClientOrigin:   clientOrigin,
		FallbackMode:   fallbackMode,
	}
}
