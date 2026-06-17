package models

import (
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type WebhookCreateInput struct {
	Type      schema.WebhookType    `json:"type" required:"true"`
	TeamID    uuid.UUID             `json:"team_id" format:"uuid" required:"true"`
	ProjectID *uuid.UUID            `json:"project_id,omitempty" format:"uuid" required:"false" doc:"required if type is project"`
	URL       string                `json:"url" format:"uri" required:"true"`
	Events    []schema.WebhookEvent `json:"events" required:"true" nullable:"false"`
}

type WebhookUpdateInput struct {
	ID        uuid.UUID              `json:"id" format:"uuid" required:"true"`
	TeamID    uuid.UUID              `json:"team_id" format:"uuid" required:"true"`
	ProjectID *uuid.UUID             `json:"project_id,omitempty" format:"uuid" required:"false" doc:"required if type is project"`
	URL       *string                `json:"url" format:"uri" required:"false"`
	Events    *[]schema.WebhookEvent `json:"events" required:"false"`
}

type WebhookListInput struct {
	Type      schema.WebhookType `query:"type" required:"true"`
	TeamID    uuid.UUID          `query:"team_id" format:"uuid" required:"true"`
	ProjectID uuid.UUID          `query:"project_id" format:"uuid" required:"false"`
}

type WebhookGetInput struct {
	ID        uuid.UUID `query:"id" format:"uuid" required:"true"`
	TeamID    uuid.UUID `query:"team_id" format:"uuid" required:"true"`
	ProjectID uuid.UUID `query:"project_id" format:"uuid" required:"false"`
}
