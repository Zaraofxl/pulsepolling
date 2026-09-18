package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"pulsepoll-backend/internal/config"
	"pulsepoll-backend/internal/handlers"
	"pulsepoll-backend/internal/middleware"
	"pulsepoll-backend/internal/realtime"
	"pulsepoll-backend/internal/repository"
	"pulsepoll-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// PULSEPOLL BACKEND SERVER
// Production-grade live polling server powered by Go (Gin), Redis, and MongoDB.
// ============================================================================

func main() {
	log.Println("==========================================================")
	log.Println("  🚀 STARTING PULSEPOLL LIVE POLLING ENGINE (GO + GIN)")
	log.Println("==========================================================")

	// ------------------------------------------------------------------------
	// STEP 1: Load Application Configuration
	// ------------------------------------------------------------------------
	cfg := config.LoadConfig()
	log.Printf("[Config] Port: %s | Mongo: %s | Redis: %s", cfg.ServerPort, cfg.MongoURI, cfg.RedisAddr)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// ------------------------------------------------------------------------
	// STEP 2: Initialize MongoDB Data Store (with safe in-memory fallback)
	// ------------------------------------------------------------------------
	var userRepo repository.UserRepository
	var pollRepo repository.PollRepository

	mongoRepo, err := repository.NewMongoRepository(ctx, cfg.MongoURI, cfg.MongoDBName)
	if err != nil {
		log.Printf("[MongoDB] Notice: Could not connect to MongoDB (%v). Running with resilient in-memory database store.", err)
		memRepo := repository.NewInMemoryRepository()
		userRepo = memRepo
		pollRepo = memRepo
	} else {
		userRepo = mongoRepo
		pollRepo = mongoRepo
	}

	// ------------------------------------------------------------------------
	// STEP 3: Initialize Redis Realtime Engine (with safe in-memory fallback)
	// ------------------------------------------------------------------------
	var realtimeRepo repository.RealtimeRepository

	redisRepo, err := repository.NewRedisRepository(ctx, cfg.RedisAddr, cfg.RedisPassword, cfg.RedisDB)
	if err != nil {
		log.Printf("[Redis] Notice: Could not connect to Redis (%v). Running with resilient in-memory pub/sub & atomic counter engine.", err)
		realtimeRepo = repository.NewInMemoryRealtimeRepository()
	} else {
		realtimeRepo = redisRepo
	}

	// ------------------------------------------------------------------------
	// STEP 4: Instantiate Business Services
	// ------------------------------------------------------------------------
	authService := services.NewAuthService(userRepo, cfg)
	pollService := services.NewPollService(pollRepo, realtimeRepo, userRepo)
	voteService := services.NewVoteService(pollRepo, realtimeRepo)

	// ------------------------------------------------------------------------
	// STEP 5: Launch WebSocket Realtime Hub
	// ------------------------------------------------------------------------
	wsHub := realtime.NewHub(realtimeRepo)
	go wsHub.Run()

	// ------------------------------------------------------------------------
	// STEP 6: Initialize HTTP Handlers
	// ------------------------------------------------------------------------
	authHandler := handlers.NewAuthHandler(authService)
	pollHandler := handlers.NewPollHandler(pollService)
	voteHandler := handlers.NewVoteHandler(voteService)
	wsHandler := handlers.NewWSHandler(wsHub)

	// ------------------------------------------------------------------------
	// STEP 7: Configure Gin Router & Middleware
	// ------------------------------------------------------------------------
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(middleware.CORSMiddleware())

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"service":   "pulsepoll-backend",
			"timestamp": time.Now().UTC(),
		})
	})

	// WebSocket Live Streaming Route
	router.GET("/ws/polls/:id", wsHandler.HandleWebSocket)

	// API Route Group
	api := router.Group("/api")
	{
		// --------------------------------------------------------------------
		// Authentication Routes (Public & Protected)
		// --------------------------------------------------------------------
		authGroup := api.Group("/auth")
		{
			authGroup.POST("/register", authHandler.Register)
			authGroup.POST("/login", authHandler.Login)
			authGroup.GET("/me", middleware.AuthMiddleware(authService), authHandler.GetMe)
		}

		// --------------------------------------------------------------------
		// Poll Management Routes
		// --------------------------------------------------------------------
		pollGroup := api.Group("/polls")
		{
			// Public routes (voters & viewers)
			pollGroup.GET("/:id", pollHandler.GetPoll)
			pollGroup.GET("/:id/voted", voteHandler.CheckIfVoted)
			pollGroup.POST("/:id/vote", voteHandler.CastVote)
			pollGroup.POST("/:id/reactions", voteHandler.SendReaction)

			// Protected routes (authenticated poll creators)
			protectedPolls := pollGroup.Group("")
			protectedPolls.Use(middleware.AuthMiddleware(authService))
			{
				protectedPolls.POST("", pollHandler.CreatePoll)
				protectedPolls.GET("/my", pollHandler.ListMyPolls)
				protectedPolls.PUT("/:id", pollHandler.UpdatePoll)
				protectedPolls.DELETE("/:id", pollHandler.DeletePoll)
				protectedPolls.POST("/:id/reset", pollHandler.ResetPoll)
				protectedPolls.GET("/:id/export.csv", pollHandler.ExportCSV)
			}
		}
	}

	// ------------------------------------------------------------------------
	// STEP 8: Start Server with Graceful Shutdown
	// ------------------------------------------------------------------------
	srv := &http.Server{
		Addr:         ":" + cfg.ServerPort,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("[Server] PulsePoll Backend running on http://localhost:%s", cfg.ServerPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[Server] Failed to start: %v", err)
		}
	}()

	// Listen for interrupt signals (Ctrl+C, SIGTERM)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[Server] Shutting down PulsePoll gracefully...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("[Server] Forced shutdown: %v", err)
	}

	log.Println("[Server] PulsePoll exited cleanly.")
}
