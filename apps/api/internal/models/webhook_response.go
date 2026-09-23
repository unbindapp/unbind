package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type WebhookResponse struct {
	ID          uuid.UUID             `json:"id" format:"uuid"`
	URL         string                `json:"url" doc:"Blank when url_redacted is true"`
	URLRedacted bool                  `json:"url_redacted" doc:"True when the caller may not see the URL. It needs the webhook_urls capability."`
	Type        schema.WebhookType    `json:"type"`
	Events      []schema.WebhookEvent `json:"events" nullable:"false"`
	TeamID      uuid.UUID             `json:"team_id" format:"uuid"`
	ProjectID   *uuid.UUID            `json:"project_id,omitempty" required:"false" format:"uuid"`
	CreatedAt   time.Time             `json:"created_at"`
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

// Redact strips the URL, which carries the webhook's secret
func (r *WebhookResponse) Redact() {
	r.URL = ""
	r.URLRedacted = true
}

// Transforms a slice of ent.Webhook entities into a slice of WebhookResponse
func TransformWebhookEntities(entities []*ent.Webhook) []*WebhookResponse {
	responses := make([]*WebhookResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformWebhookEntity(entity)
	}
	return responses
}
