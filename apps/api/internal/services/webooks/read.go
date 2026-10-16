package webhooks_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
)

func (self *WebhooksService) GetWebhookByID(ctx context.Context, requesterUserID uuid.UUID, input *models.WebhookGetInput) (*models.WebhookResponse, error) {
	var projectID *uuid.UUID
	if input.ProjectID != uuid.Nil {
		projectID = &input.ProjectID
	}
	webhook, s, err := self.loadOwned(ctx, input.ID, input.TeamID, projectID)
	if err != nil {
		return nil, err
	}
	if err := self.authorize(ctx, requesterUserID, schema.ActionViewer, s); err != nil {
		return nil, err
	}

	response := models.TransformWebhookEntity(webhook)
	if err := self.redact(ctx, requesterUserID, s, response); err != nil {
		return nil, err
	}
	return response, nil
}

func (self *WebhooksService) ListWebhooks(ctx context.Context, requesterUserID uuid.UUID, input *models.WebhookListInput) ([]*models.WebhookResponse, error) {
	var projectID *uuid.UUID
	if input.ProjectID != uuid.Nil {
		projectID = &input.ProjectID
	}
	s, err := self.resolveScope(ctx, input.Type, input.TeamID, projectID)
	if err != nil {
		return nil, err
	}
	if err := self.authorize(ctx, requesterUserID, schema.ActionViewer, s); err != nil {
		return nil, err
	}

	var webhooks []*ent.Webhook
	switch input.Type {
	case schema.WebhookTypeProject:
		webhooks, err = self.repo.Webhooks().GetByProject(ctx, s.resourceID)
	case schema.WebhookTypeTeam:
		webhooks, err = self.repo.Webhooks().GetByTeam(ctx, s.resourceID)
	default:
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Unknown webhook type")
	}
	if err != nil {
		return nil, err
	}

	responses := models.TransformWebhookEntities(webhooks)
	if err := self.redact(ctx, requesterUserID, s, responses...); err != nil {
		return nil, err
	}
	return responses, nil
}
