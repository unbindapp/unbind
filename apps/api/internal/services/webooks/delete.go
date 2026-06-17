package webhooks_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *WebhooksService) DeleteWebhook(ctx context.Context, requesterUserID uuid.UUID, webhookType schema.WebhookType, id, teamID uuid.UUID, projectID *uuid.UUID) error {
	if webhookType == schema.WebhookTypeProject && projectID == nil {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Project ID is required for project webhooks")
	}

	permissionChecks := []permissions_repo.PermissionCheck{
		// Team editor can create projects
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   teamID,
		},
	}

	// Also check project if it's specified
	if projectID != nil {
		permissionChecks = append(permissionChecks, permissions_repo.PermissionCheck{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeProject,
			ResourceID:   *projectID,
		})
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return err
	}

	// Get the webhook
	webhook, err := self.repo.Webhooks().GetByID(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Webhook not found")
		}
		return err
	}

	if webhook.Type == schema.WebhookTypeTeam && teamID != webhook.TeamID {
		return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Webhook not found")
	}

	if webhook.Type == schema.WebhookTypeProject && (projectID == nil || webhook.ProjectID == nil || *projectID != *webhook.ProjectID) {
		return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Webhook not found")
	}

	// Delete the webhook
	if err := self.repo.Webhooks().Delete(ctx, id); err != nil {
		return err
	}

	return nil
}
