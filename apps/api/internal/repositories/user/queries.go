package user_repo

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/user"
	"golang.org/x/crypto/bcrypt"
)

func (self *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*ent.User, error) {
	return self.base.DB.User.Get(ctx, id)
}

func (self *UserRepository) GetByEmail(ctx context.Context, email string) (*ent.User, error) {
	return self.base.DB.User.Query().Where(user.EmailEQ(email)).Only(ctx)
}

var (
	ErrUserNotFound     = errors.New("user not found")
	ErrInvalidPassword  = errors.New("invalid password")
	ErrInvalidUserInput = errors.New("invalid user input")
)

// Authenticate verifies a user's credentials and returns the user if successful
func (self *UserRepository) Authenticate(ctx context.Context, email, password string) (*ent.User, error) {
	if email == "" || password == "" {
		return nil, ErrInvalidUserInput
	}

	// Find the user by email
	user, err := self.base.DB.User.
		Query().
		Where(user.EmailEQ(email)).
		Only(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("querying user: %w", err)
	}

	// Verify password using bcrypt
	if err := verifyPassword(user.PasswordHash, password); err != nil {
		return nil, ErrInvalidPassword
	}

	return user, nil
}

// verifyPassword checks if the provided password matches the stored hash
func verifyPassword(hashedPassword, plainPassword string) error {
	return bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(plainPassword))
}

func (self *UserRepository) GetGroups(ctx context.Context, userID uuid.UUID) ([]*ent.Group, error) {
	return self.base.DB.User.Query().Where(user.ID(userID)).QueryGroups().All(ctx)
}
