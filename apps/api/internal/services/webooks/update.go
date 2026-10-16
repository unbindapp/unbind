package webhooks_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/models"
)

func (self *WebhooksService) UpdateWebhook(ctx context.Context, requesterUserID uuid.UUID, input *models.WebhookUpdateInput) (*models.WebhookResponse, error) {
	webhook, s, err := self.loadOwned(ctx, input.ID, input.TeamID, input.ProjectID)
	if err != nil {
		return nil, err
	}
	if err := self.authorize(ctx, requesterUserID, schema.ActionEditor, s); err != nil {
		return nil, err
	}
	if input.Events != nil {
		if err := validateEvents(webhook.Type, *input.Events); err != nil {
			return nil, err
		}
	}

	webhook, err = self.repo.Webhooks().Update(ctx, input)
	if err != nil {
		return nil, err
	}
	response := models.TransformWebhookEntity(webhook)
	if err := self.redact(ctx, requesterUserID, s, response); err != nil {
		return nil, err
	}
	return response, nil
}
