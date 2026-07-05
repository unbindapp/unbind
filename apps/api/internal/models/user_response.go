package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
)

type UserResponse struct {
	ID        uuid.UUID `json:"id" format:"uuid"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TransformUserEntity transforms an ent.User entity into a UserResponse
func TransformUserEntity(entity *ent.User) *UserResponse {
	response := &UserResponse{}
	if entity != nil {
		response = &UserResponse{
			ID:        entity.ID,
			Email:     entity.Email,
			CreatedAt: entity.CreatedAt,
			UpdatedAt: entity.UpdatedAt,
		}
	}
	return response
}

// TransformUserEntities transforms a slice of ent.User entities into a slice of UserResponse
func TransformUserEntities(entities []*ent.User) []*UserResponse {
	responses := make([]*UserResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformUserEntity(entity)
	}
	return responses
}
