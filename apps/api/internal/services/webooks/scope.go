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

// A webhook belongs to one team or one project, and every decision is made on
// that one resource. The caller's ids are only accepted when they name it.
type scope struct {
	resourceType schema.ResourceType
	resourceID   uuid.UUID
}

func notFound() error {
	return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Webhook not found")
}

// resolveScope turns the caller's ids into the resource a new or listed webhook
// lives on, refusing a project that is not in the named team.
func (self *WebhooksService) resolveScope(ctx context.Context, webhookType schema.WebhookType, teamID uuid.UUID, projectID *uuid.UUID) (scope, error) {
	if webhookType != schema.WebhookTypeProject {
		return scope{schema.ResourceTypeTeam, teamID}, nil
	}
	if projectID == nil || *projectID == uuid.Nil {
		return scope{}, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Project ID is required for project webhooks")
	}
	project, err := self.repo.Project().GetByID(ctx, *projectID)
	if err != nil {
		if ent.IsNotFound(err) {
			return scope{}, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found")
		}
		return scope{}, err
	}
	if project.TeamID != teamID {
		return scope{}, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found")
	}
	return scope{schema.ResourceTypeProject, *projectID}, nil
}

// loadOwned fetches a webhook and checks the caller named its team and project.
func (self *WebhooksService) loadOwned(ctx context.Context, id, teamID uuid.UUID, projectID *uuid.UUID) (*ent.Webhook, scope, error) {
	webhook, err := self.repo.Webhooks().GetByID(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, scope{}, notFound()
		}
		return nil, scope{}, err
	}
	if webhook.TeamID != teamID {
		return nil, scope{}, notFound()
	}
	if webhook.Type == schema.WebhookTypeProject {
		if webhook.ProjectID == nil || projectID == nil || *projectID != *webhook.ProjectID {
			return nil, scope{}, notFound()
		}
		return webhook, scope{schema.ResourceTypeProject, *webhook.ProjectID}, nil
	}
	return webhook, scope{schema.ResourceTypeTeam, webhook.TeamID}, nil
}

func (self *WebhooksService) authorize(ctx context.Context, userID uuid.UUID, action schema.PermittedAction, s scope) error {
	err := self.repo.Permissions().Check(ctx, userID, []permissions_repo.PermissionCheck{
		{Action: action, ResourceType: s.resourceType, ResourceID: s.resourceID},
	})
	return errdefs.MaskAsNotFound(err, "Webhook not found")
}

// redact blanks the URL unless the caller may read secrets on the webhook's
// scope: editor for sessions, read_webhook_urls plus an editor owner for keys.
func (self *WebhooksService) redact(ctx context.Context, userID uuid.UUID, s scope, responses ...*models.WebhookResponse) error {
	canRead, err := permissions_repo.CanReadSecrets(ctx, self.repo.Permissions(), userID, schema.PrivilegeReadWebhookURLs, s.resourceType, s.resourceID)
	if err != nil {
		return err
	}
	if canRead {
		return nil
	}
	for _, response := range responses {
		response.Redact()
	}
	return nil
}
