package webhooks_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *WebhooksService) CreateWebhook(ctx context.Context, requesterUserID uuid.UUID, input *models.WebhookCreateInput) (*models.WebhookResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Team editor can create projects
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   input.TeamID,
		},
	}

	// Also check project if it's specified
	if input.Type == schema.WebhookTypeProject {
		if input.ProjectID == nil {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Project ID is required for project webhooks")
		}

		permissionChecks = append(permissionChecks, permissions_repo.PermissionCheck{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeProject,
			ResourceID:   *input.ProjectID,
		})
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	if err := validateEvents(input.Type, input.Events); err != nil {
		return nil, err
	}

	webhook, err := self.repo.Webhooks().Create(ctx, input)
	if err != nil {
		return nil, err
	}

	return self.redactURL(ctx, models.TransformWebhookEntity(webhook)), nil
}

func validateEvents(webhookType schema.WebhookType, events []schema.WebhookEvent) error {
	for _, event := range events {
		if event.WebhookType() != webhookType {
			return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("Event %s is not available for %s webhooks", event, webhookType))
		}
	}
	return nil
}
