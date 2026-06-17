package user_handler

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

type MeResponse struct {
	Body struct {
		Data *UserAPIResponse `json:"data"`
	}
}

// Me handles GET /me
func (self *HandlerGroup) Me(ctx context.Context, _ *server.BaseAuthInput) (*MeResponse, error) {

	user, ok := ctx.Value("user").(*ent.User)
	if !ok {
		log.Error("Error getting user from context")
		return nil, huma.Error500InternalServerError("Unable to retrieve user")
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
