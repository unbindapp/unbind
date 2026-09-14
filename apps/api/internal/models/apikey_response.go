package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type APIKeyResponse struct {
	ID          uuid.UUID               `json:"id" format:"uuid"`
	UserID      uuid.UUID               `json:"user_id" format:"uuid"`
	Name        string                  `json:"name"`
	TokenPrefix string                  `json:"token_prefix" doc:"First characters of the token, for recognizing the key. Never the full token."`
	Role        schema.PermittedAction  `json:"role"`
	FullAccess  bool                    `json:"full_access"`
	Resources   []schema.APIKeyResource `json:"resources" nullable:"false"`
	ExpiresAt   *time.Time              `json:"expires_at,omitempty" required:"false"`
	LastUsedAt  *time.Time              `json:"last_used_at,omitempty" required:"false"`
	CreatedAt   time.Time               `json:"created_at"`
}

// APIKeyCreatedResponse carries the plaintext token, returned once at creation.
type APIKeyCreatedResponse struct {
	APIKeyResponse
	Token string `json:"token" doc:"The full API key. Shown once, store it now."`
}

func TransformAPIKeyEntity(entity *ent.APIKey) *APIKeyResponse {
	if entity == nil {
		return &APIKeyResponse{}
	}
	resources := entity.Resources
	if resources == nil {
		resources = []schema.APIKeyResource{}
	}
	return &APIKeyResponse{
		ID:          entity.ID,
		UserID:      entity.UserID,
		Name:        entity.Name,
		TokenPrefix: entity.TokenPrefix,
		Role:        entity.Role,
		FullAccess:  entity.FullAccess,
		Resources:   resources,
		ExpiresAt:   entity.ExpiresAt,
		LastUsedAt:  entity.LastUsedAt,
		CreatedAt:   entity.CreatedAt,
	}
}

func TransformAPIKeyEntities(entities []*ent.APIKey) []*APIKeyResponse {
	responses := make([]*APIKeyResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformAPIKeyEntity(entity)
	}
	return responses
}
