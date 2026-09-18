package repository

import (
	"context"
	"errors"
	"log"
	"sync"
	"time"

	"pulsepoll-backend/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ============================================================================
// MONGODB PERSISTENT REPOSITORY IMPLEMENTATION
// Handles MongoDB collections: "users", "polls", and "vote_logs".
// Includes an in-memory fallback implementation for environments without Mongo.
// ============================================================================

// MongoRepository implements UserRepository and PollRepository using official MongoDB driver.
type MongoRepository struct {
	client    *mongo.Client
	database  *mongo.Database
	usersCol  *mongo.Collection
	pollsCol  *mongo.Collection
	votesCol  *mongo.Collection
}

// NewMongoRepository connects to MongoDB and initializes collections and unique indexes.
func NewMongoRepository(ctx context.Context, uri string, dbName string) (*MongoRepository, error) {
	// Connect to MongoDB with a 5-second timeout
	clientOptions := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, err
	}

	// Ping database to verify connection health
	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx, nil); err != nil {
		return nil, err
	}

	db := client.Database(dbName)
	repo := &MongoRepository{
		client:   client,
		database: db,
		usersCol: db.Collection("users"),
		pollsCol: db.Collection("polls"),
		votesCol: db.Collection("vote_logs"),
	}

	// Create unique index on user emails to guarantee data integrity
	go func() {
		emailIndex := mongo.IndexModel{
			Keys:    bson.D{{Key: "email", Value: 1}},
			Options: options.Index().SetUnique(true),
		}
		_, _ = repo.usersCol.Indexes().CreateOne(context.Background(), emailIndex)

		// Create unique index on poll shareable code
		codeIndex := mongo.IndexModel{
			Keys:    bson.D{{Key: "code", Value: 1}},
			Options: options.Index().SetUnique(true),
		}
		_, _ = repo.pollsCol.Indexes().CreateOne(context.Background(), codeIndex)
	}()

	log.Printf("[MongoDB] Successfully connected to database: %s", dbName)
	return repo, nil
}

// ----------------------------------------------------------------------------
// USER REPOSITORY METHODS (MongoDB)
// ----------------------------------------------------------------------------

func (r *MongoRepository) CreateUser(ctx context.Context, user *models.User) error {
	user.ID = primitive.NewObjectID()
	user.CreatedAt = time.Now().UTC()
	user.UpdatedAt = time.Now().UTC()

	_, err := r.usersCol.InsertOne(ctx, user)
	return err
}

func (r *MongoRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	err := r.usersCol.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return &user, nil
}

func (r *MongoRepository) FindByID(ctx context.Context, id string) (*models.User, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errors.New("invalid user ID format")
	}

	var user models.User
	err = r.usersCol.FindOne(ctx, bson.M{"_id": objID}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return &user, nil
}

// ----------------------------------------------------------------------------
// POLL REPOSITORY METHODS (MongoDB)
// ----------------------------------------------------------------------------

func (r *MongoRepository) CreatePoll(ctx context.Context, poll *models.Poll) error {
	if poll.ID.IsZero() {
		poll.ID = primitive.NewObjectID()
	}
	poll.CreatedAt = time.Now().UTC()
	poll.UpdatedAt = time.Now().UTC()

	_, err := r.pollsCol.InsertOne(ctx, poll)
	return err
}

func (r *MongoRepository) GetPollByID(ctx context.Context, id string) (*models.Poll, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errors.New("invalid poll ID format")
	}

	var poll models.Poll
	err = r.pollsCol.FindOne(ctx, bson.M{"_id": objID}).Decode(&poll)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("poll not found")
		}
		return nil, err
	}
	return &poll, nil
}

func (r *MongoRepository) GetPollByCode(ctx context.Context, code string) (*models.Poll, error) {
	var poll models.Poll
	err := r.pollsCol.FindOne(ctx, bson.M{"code": code}).Decode(&poll)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("poll not found with provided code")
		}
		return nil, err
	}
	return &poll, nil
}

func (r *MongoRepository) ListPollsByCreator(ctx context.Context, creatorID string) ([]*models.Poll, error) {
	objID, err := primitive.ObjectIDFromHex(creatorID)
	if err != nil {
		return nil, errors.New("invalid creator ID")
	}

	findOptions := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cursor, err := r.pollsCol.Find(ctx, bson.M{"creator_id": objID}, findOptions)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var polls []*models.Poll
	for cursor.Next(ctx) {
		var p models.Poll
		if err := cursor.Decode(&p); err != nil {
			return nil, err
		}
		polls = append(polls, &p)
	}
	return polls, nil
}

func (r *MongoRepository) UpdatePoll(ctx context.Context, poll *models.Poll) error {
	poll.UpdatedAt = time.Now().UTC()
	filter := bson.M{"_id": poll.ID}
	update := bson.M{
		"$set": bson.M{
			"title":       poll.Title,
			"description": poll.Description,
			"is_active":   poll.IsActive,
			"settings":    poll.Settings,
			"updated_at":  poll.UpdatedAt,
		},
	}
	_, err := r.pollsCol.UpdateOne(ctx, filter, update)
	return err
}

func (r *MongoRepository) UpdateOptionVotes(ctx context.Context, pollID string, optionCounts map[string]int64, totalVotes int64) error {
	objID, err := primitive.ObjectIDFromHex(pollID)
	if err != nil {
		return errors.New("invalid poll ID")
	}

	// Fetch current poll to update matching options in array
	poll, err := r.GetPollByID(ctx, pollID)
	if err != nil {
		return err
	}

	for i := range poll.Options {
		if count, exists := optionCounts[poll.Options[i].ID]; exists {
			poll.Options[i].Votes = count
		}
	}

	filter := bson.M{"_id": objID}
	update := bson.M{
		"$set": bson.M{
			"options":     poll.Options,
			"total_votes": totalVotes,
			"updated_at":  time.Now().UTC(),
		},
	}
	_, err = r.pollsCol.UpdateOne(ctx, filter, update)
	return err
}

func (r *MongoRepository) DeletePoll(ctx context.Context, id string, creatorID string) error {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return errors.New("invalid poll ID")
	}
	creatorObjID, err := primitive.ObjectIDFromHex(creatorID)
	if err != nil {
		return errors.New("invalid creator ID")
	}

	res, err := r.pollsCol.DeleteOne(ctx, bson.M{"_id": objID, "creator_id": creatorObjID})
	if err != nil {
		return err
	}
	if res.DeletedCount == 0 {
		return errors.New("poll not found or permission denied")
	}
	return nil
}

func (r *MongoRepository) RecordVoteAuditLog(ctx context.Context, log *models.VoteLog) error {
	log.ID = primitive.NewObjectID()
	log.CreatedAt = time.Now().UTC()
	_, err := r.votesCol.InsertOne(ctx, log)
	return err
}

func (r *MongoRepository) GetVoteLogs(ctx context.Context, pollID string) ([]*models.VoteLog, error) {
	objID, err := primitive.ObjectIDFromHex(pollID)
	if err != nil {
		return nil, errors.New("invalid poll ID")
	}

	findOptions := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cursor, err := r.votesCol.Find(ctx, bson.M{"poll_id": objID}, findOptions)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var logs []*models.VoteLog
	for cursor.Next(ctx) {
		var l models.VoteLog
		if err := cursor.Decode(&l); err != nil {
			return nil, err
		}
		logs = append(logs, &l)
	}
	return logs, nil
}

// ============================================================================
// IN-MEMORY FALLBACK REPOSITORY
// Used when MongoDB is not running locally, guaranteeing zero runtime disruption.
// ============================================================================

type InMemoryRepository struct {
	mu       sync.RWMutex
	users    map[string]*models.User
	polls    map[string]*models.Poll
	voteLogs map[string][]*models.VoteLog
}

func NewInMemoryRepository() *InMemoryRepository {
	log.Println("[Database] Initialized thread-safe In-Memory fallback store")
	return &InMemoryRepository{
		users:    make(map[string]*models.User),
		polls:    make(map[string]*models.Poll),
		voteLogs: make(map[string][]*models.VoteLog),
	}
}

func (m *InMemoryRepository) CreateUser(ctx context.Context, user *models.User) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, existing := range m.users {
		if existing.Email == user.Email {
			return errors.New("email address already registered")
		}
	}

	if user.ID.IsZero() {
		user.ID = primitive.NewObjectID()
	}
	user.CreatedAt = time.Now().UTC()
	user.UpdatedAt = time.Now().UTC()
	m.users[user.ID.Hex()] = user
	return nil
}

func (m *InMemoryRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, u := range m.users {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, errors.New("user not found")
}

func (m *InMemoryRepository) FindByID(ctx context.Context, id string) (*models.User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if u, exists := m.users[id]; exists {
		return u, nil
	}
	return nil, errors.New("user not found")
}

func (m *InMemoryRepository) CreatePoll(ctx context.Context, poll *models.Poll) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if poll.ID.IsZero() {
		poll.ID = primitive.NewObjectID()
	}
	poll.CreatedAt = time.Now().UTC()
	poll.UpdatedAt = time.Now().UTC()
	m.polls[poll.ID.Hex()] = poll
	return nil
}

func (m *InMemoryRepository) GetPollByID(ctx context.Context, id string) (*models.Poll, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if poll, exists := m.polls[id]; exists {
		return poll, nil
	}
	return nil, errors.New("poll not found")
}

func (m *InMemoryRepository) GetPollByCode(ctx context.Context, code string) (*models.Poll, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, p := range m.polls {
		if p.Code == code {
			return p, nil
		}
	}
	return nil, errors.New("poll not found with provided code")
}

func (m *InMemoryRepository) ListPollsByCreator(ctx context.Context, creatorID string) ([]*models.Poll, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []*models.Poll
	for _, p := range m.polls {
		if p.CreatorID.Hex() == creatorID {
			result = append(result, p)
		}
	}
	return result, nil
}

func (m *InMemoryRepository) UpdatePoll(ctx context.Context, poll *models.Poll) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	idStr := poll.ID.Hex()
	if _, exists := m.polls[idStr]; !exists {
		return errors.New("poll not found")
	}
	poll.UpdatedAt = time.Now().UTC()
	m.polls[idStr] = poll
	return nil
}

func (m *InMemoryRepository) UpdateOptionVotes(ctx context.Context, pollID string, optionCounts map[string]int64, totalVotes int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	poll, exists := m.polls[pollID]
	if !exists {
		return errors.New("poll not found")
	}

	for i := range poll.Options {
		if count, found := optionCounts[poll.Options[i].ID]; found {
			poll.Options[i].Votes = count
		}
	}
	poll.TotalVotes = totalVotes
	poll.UpdatedAt = time.Now().UTC()
	return nil
}

func (m *InMemoryRepository) DeletePoll(ctx context.Context, id string, creatorID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	poll, exists := m.polls[id]
	if !exists {
		return errors.New("poll not found")
	}
	if poll.CreatorID.Hex() != creatorID {
		return errors.New("permission denied")
	}

	delete(m.polls, id)
	delete(m.voteLogs, id)
	return nil
}

func (m *InMemoryRepository) RecordVoteAuditLog(ctx context.Context, log *models.VoteLog) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if log.ID.IsZero() {
		log.ID = primitive.NewObjectID()
	}
	log.CreatedAt = time.Now().UTC()
	pollIDStr := log.PollID.Hex()
	m.voteLogs[pollIDStr] = append(m.voteLogs[pollIDStr], log)
	return nil
}

func (m *InMemoryRepository) GetVoteLogs(ctx context.Context, pollID string) ([]*models.VoteLog, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return m.voteLogs[pollID], nil
}
