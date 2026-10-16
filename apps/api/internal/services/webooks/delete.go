package webhooks_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func (self *WebhooksService) DeleteWebhook(ctx context.Context, requesterUserID uuid.UUID, webhookType schema.WebhookType, id, teamID uuid.UUID, projectID *uuid.UUID) error {
	_, s, err := self.loadOwned(ctx, id, teamID, projectID)
	if err != nil {
		return err
	}
	if err := self.authorize(ctx, requesterUserID, schema.ActionEditor, s); err != nil {
		return err
	}
	return self.repo.Webhooks().Delete(ctx, id)
}
