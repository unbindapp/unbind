package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type APIKeyResponse struct {
	ID           uuid.UUID                `json:"id" format:"uuid"`
	UserID       uuid.UUID                `json:"user_id" format:"uuid"`
	Name         string                   `json:"name"`
	TokenPrefix  string                   `json:"token_prefix" doc:"First characters of the token, for recognizing the key. Never the full token."`
	Role         schema.PermittedAction   `json:"role"`
	FullAccess   bool                     `json:"full_access"`
	Resources    []APIKeyResourceResponse `json:"resources" nullable:"false"`
	Capabilities []schema.KeyCapability   `json:"capabilities" nullable:"false"`
	ExpiresAt    *time.Time               `json:"expires_at,omitempty" required:"false"`
	LastUsedAt   *time.Time               `json:"last_used_at,omitempty" required:"false"`
	CreatedAt    time.Time                `json:"created_at"`
}

// APIKeyResourceResponse is a key resource with the names leading to it, so a
// list can show "Team › Project" without resolving ids itself.
type APIKeyResourceResponse struct {
	schema.APIKeyResource
	Path []string `json:"path" nullable:"false" doc:"Names from the team down to the resource. Empty when the resource no longer exists."`
}

// APIKeyCreatedResponse carries the plaintext token, returned once at creation.
type APIKeyCreatedResponse struct {
	APIKeyResponse
	Token string `json:"token" doc:"The full API key. Shown once, store it now."`
}

// TransformAPIKeyEntity maps the key; paths is keyed by resource id and may be nil.
func TransformAPIKeyEntity(entity *ent.APIKey, paths map[uuid.UUID][]string) *APIKeyResponse {
	if entity == nil {
		return &APIKeyResponse{}
	}
	resources := make([]APIKeyResourceResponse, 0, len(entity.Resources))
	for _, resource := range entity.Resources {
		path := paths[resource.ResourceID]
		if path == nil {
			path = []string{}
		}
		resources = append(resources, APIKeyResourceResponse{APIKeyResource: resource, Path: path})
	}
	return &APIKeyResponse{
		ID:           entity.ID,
		UserID:       entity.UserID,
		Name:         entity.Name,
		TokenPrefix:  entity.TokenPrefix,
		Role:         entity.Role,
		FullAccess:   entity.FullAccess,
		Resources:    resources,
		Capabilities: capabilitiesOf(entity.Capabilities),
		ExpiresAt:    entity.ExpiresAt,
		LastUsedAt:   entity.LastUsedAt,
		CreatedAt:    entity.CreatedAt,
	}
}

func capabilitiesOf(capabilities []schema.KeyCapability) []schema.KeyCapability {
	if capabilities == nil {
		return []schema.KeyCapability{}
	}
	return capabilities
}

func TransformAPIKeyEntities(entities []*ent.APIKey, paths map[uuid.UUID][]string) []*APIKeyResponse {
	responses := make([]*APIKeyResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformAPIKeyEntity(entity, paths)
	}
	return responses
}
