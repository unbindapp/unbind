package webhooks_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
)

func (self *WebhooksService) CreateWebhook(ctx context.Context, requesterUserID uuid.UUID, input *models.WebhookCreateInput) (*models.WebhookResponse, error) {
	s, err := self.resolveScope(ctx, input.Type, input.TeamID, input.ProjectID)
	if err != nil {
		return nil, err
	}
	if err := self.authorize(ctx, requesterUserID, schema.ActionEditor, s); err != nil {
		return nil, err
	}
	if err := validateEvents(input.Type, input.Events); err != nil {
		return nil, err
	}

	webhook, err := self.repo.Webhooks().Create(ctx, input)
	if err != nil {
		return nil, err
	}
	response := models.TransformWebhookEntity(webhook)
	if err := self.redact(ctx, requesterUserID, s, response); err != nil {
		return nil, err
	}
	return response, nil
}

func validateEvents(webhookType schema.WebhookType, events []schema.WebhookEvent) error {
	for _, event := range events {
		if event.WebhookType() != webhookType {
			return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("Event %s is not available for %s webhooks", event, webhookType))
		}
	}
	return nil
}
