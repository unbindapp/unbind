package webhooks_service

import (
	"context"

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

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Create the webhook
	webhook, err := self.repo.Webhooks().Create(ctx, input)
	if err != nil {
		return nil, err
	}

	return models.TransformWebhookEntity(webhook), nil
}
