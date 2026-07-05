package user_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"golang.org/x/crypto/bcrypt"
)

func (self *UserRepository) GetAll(ctx context.Context) ([]*ent.User, error) {
	return self.base.DB.User.Query().All(ctx)
}

func (self *UserRepository) Create(ctx context.Context, email, password string) (*ent.User, error) {
	if email == "" || password == "" {
		return nil, ErrInvalidUserInput
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	return self.base.DB.User.Create().
		SetEmail(email).
		SetPasswordHash(string(hashedPassword)).
		Save(ctx)
}

func (self *UserRepository) UpdatePassword(ctx context.Context, userID uuid.UUID, password string) error {
	if password == "" {
		return ErrInvalidUserInput
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	return self.base.DB.User.UpdateOneID(userID).
		SetPasswordHash(string(hashedPassword)).
		Exec(ctx)
}

func (self *UserRepository) Delete(ctx context.Context, userID uuid.UUID) error {
	return self.base.DB.User.DeleteOneID(userID).Exec(ctx)
}
