package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ============================================================================
// USER MODEL
// Represents registered poll creators/hosts stored in MongoDB.
// ============================================================================

// User represents a registered account holder who can create and manage polls.
type User struct {
	// ID: Unique MongoDB Object ID for the user
	ID primitive.ObjectID `bson:"_id,omitempty" json:"id"`

	// Name: Full display name of the user
	Name string `bson:"name" json:"name" binding:"required,min=2,max=100"`

	// Email: Unique email address used for login authentication
	Email string `bson:"email" json:"email" binding:"required,email"`

	// Password: Encrypted bcrypt password hash (never returned in JSON response)
	Password string `bson:"password" json:"-"`

	// CreatedAt: UTC timestamp when the user account was registered
	CreatedAt time.Time `bson:"created_at" json:"created_at"`

	// UpdatedAt: UTC timestamp when the user account was last modified
	UpdatedAt time.Time `bson:"updated_at" json:"updated_at"`
}

// UserRegisterRequest represents client payload for new account registration.
type UserRegisterRequest struct {
	Name     string `json:"name" binding:"required,min=2,max=100"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6,max=100"`
}

// UserLoginRequest represents client payload for signing into an existing account.
type UserLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// UserResponse represents sanitized user profile information returned to clients.
type UserResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

// AuthResponse represents the authentication payload returned upon successful login/signup.
type AuthResponse struct {
	Token string       `json:"token"`
	User  UserResponse `json:"user"`
}
