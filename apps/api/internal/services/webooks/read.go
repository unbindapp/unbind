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

func (self *WebhooksService) GetWebhookByID(ctx context.Context, requesterUserID uuid.UUID, input *models.WebhookGetInput) (*models.WebhookResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   input.TeamID,
		},
	}

	// Also check project if it's specified
	if input.ProjectID != uuid.Nil {
		permissionChecks = append(permissionChecks, permissions_repo.PermissionCheck{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeProject,
			ResourceID:   input.ProjectID,
		})
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Get webhook by ID
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

	if webhook.Type == schema.WebhookTypeProject && (input.ProjectID == uuid.Nil || webhook.ProjectID == nil || input.ProjectID != *webhook.ProjectID) {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Webhook not found")
	}

	webhook, err = self.repo.Webhooks().GetByID(ctx, input.ID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Webhook not found")
		}
		return nil, err
	}

	return models.TransformWebhookEntity(webhook), nil
}

func (self *WebhooksService) ListWebhooks(ctx context.Context, requesterUserID uuid.UUID, input *models.WebhookListInput) ([]*models.WebhookResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Team editor can create projects
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   input.TeamID,
		},
	}

	// Also check project if it's specified
	if input.ProjectID != uuid.Nil {
		permissionChecks = append(permissionChecks, permissions_repo.PermissionCheck{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeProject,
			ResourceID:   input.ProjectID,
		})
	} else if input.Type == schema.WebhookTypeProject {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Project ID is required for project webhooks")
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	webhooks := []*ent.Webhook{}
	var err error
	switch input.Type {
	case schema.WebhookTypeProject:
		webhooks, err = self.repo.Webhooks().GetByProject(ctx, input.ProjectID)
	case schema.WebhookTypeTeam:
		webhooks, err = self.repo.Webhooks().GetByTeam(ctx, input.TeamID)
	}
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Webhooks not found")
		}
		return nil, err
	}

	return models.TransformWebhookEntities(webhooks), nil
}
