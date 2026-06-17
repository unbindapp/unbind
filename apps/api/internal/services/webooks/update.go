package webhooks_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *WebhooksService) UpdateWebhook(ctx context.Context, requesterUserID uuid.UUID, input *models.WebhookUpdateInput) (*models.WebhookResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Team editor can create projects
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   input.TeamID,
		},
	}

	// Also check project if it's specified
	if input.ProjectID != nil {
		permissionChecks = append(permissionChecks, permissions_repo.PermissionCheck{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeProject,
			ResourceID:   *input.ProjectID,
		})
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Get the webhook
	webhook, err := self.repo.Webhooks().GetByID(ctx, input.ID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Webhook not found")
		}
		return nil, err
	}

	if webhook.Type == schema.WebhookTypeTeam && input.TeamID != webhook.TeamID {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Webhook not found")
	}

	if webhook.Type == schema.WebhookTypeProject && (input.ProjectID == nil || webhook.ProjectID == nil || *input.ProjectID != *webhook.ProjectID) {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Webhook not found")
	}
	// Update the webhook
	webhook, err = self.repo.Webhooks().Update(ctx, input)
	if err != nil {
		return nil, err
	}

	return models.TransformWebhookEntity(webhook), nil
}
