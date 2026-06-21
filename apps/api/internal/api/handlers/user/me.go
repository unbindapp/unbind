package user_handler

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/api/server"
)

type MeResponse struct {
	Body struct {
		Data *UserAPIResponse `json:"data"`
	}
}

// Me handles GET /me
func (self *HandlerGroup) Me(ctx context.Context, _ *server.BaseAuthInput) (*MeResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	resp := &MeResponse{}
	resp.Body.Data = transformUserEntity(user)
	return resp, nil
}

func transformUserEntity(entity *ent.User) *UserAPIResponse {
	return &UserAPIResponse{
		ID:        entity.ID,
		CreatedAt: entity.CreatedAt,
		UpdatedAt: entity.UpdatedAt,
		Email:     entity.Email,
	}
}

type UserAPIResponse struct {
	ID uuid.UUID `json:"id"`
	// The time at which the entity was created.
	CreatedAt time.Time `json:"created_at,omitempty"`
	// The time at which the entity was last updated.
	UpdatedAt time.Time `json:"updated_at,omitempty"`
	// Email holds the value of the "email" field.
	Email string `json:"email,omitempty"`
}
