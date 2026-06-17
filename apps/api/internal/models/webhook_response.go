package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type WebhookResponse struct {
	ID        uuid.UUID             `json:"id"`
	URL       string                `json:"url"`
	Type      schema.WebhookType    `json:"type"`
	Events    []schema.WebhookEvent `json:"events" nullable:"false"`
	TeamID    uuid.UUID             `json:"team_id"`
	ProjectID *uuid.UUID            `json:"project_id,omitempty" required:"false"`
	CreatedAt time.Time             `json:"created_at"`
}

// TransformWebhookEntity transforms an ent.Webhook entity into a WebhookResponse
func TransformWebhookEntity(entity *ent.Webhook) *WebhookResponse {
	response := &WebhookResponse{}
	if entity != nil {
		response = &WebhookResponse{
			ID:        entity.ID,
			URL:       entity.URL,
			Type:      entity.Type,
			Events:    entity.Events,
			TeamID:    entity.TeamID,
			ProjectID: entity.ProjectID,
			CreatedAt: entity.CreatedAt,
		}
	}
	return response
}

// Transforms a slice of ent.Webhook entities into a slice of WebhookResponse
func TransformWebhookEntities(entities []*ent.Webhook) []*WebhookResponse {
	responses := make([]*WebhookResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformWebhookEntity(entity)
	}
	return responses
}
