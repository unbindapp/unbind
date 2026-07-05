package project_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	webhooks_service "github.com/unbindapp/unbind-api/internal/services/webooks"
)

func (self *ProjectService) UpdateProject(ctx context.Context, requesterUserID uuid.UUID, input *models.UpdateProjectInput) (*models.ProjectResponse, error) {
	if input.Name == "" && input.Description == nil {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "No fields to update")
	}

	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to update project
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeProject,
			ResourceID:   input.ProjectID,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	_, err := self.repo.Team().GetByID(ctx, input.TeamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, err
	}

	// Make sure project exists and is in the team
	project, err := self.repo.Project().GetByID(ctx, input.ProjectID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found")
		}
		return nil, err
	}
	if project.TeamID != input.TeamID {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Project not in team")
	}

	project, err = self.repo.Project().Update(ctx, nil, input.ProjectID, input.DefaultEnvironmentID, input.Name, input.Description)
	if err != nil {
		return nil, err
	}

	// Trigger webhook
	go func() {
		event := schema.WebhookEventProjectUpdated
		level := webhooks_service.WebhookLevelInfo

		project, err := self.repo.Project().GetByID(context.Background(), project.ID)
		if err != nil {
			log.Errorf("Failed to get project %s: %v", project.ID.String(), err)
			return
		}

		url, _ := utils.JoinURLPaths(self.cfg.ExternalUIUrl, project.TeamID.String(), "project", project.ID.String())
		user, err := self.repo.User().GetByID(context.Background(), requesterUserID)
		if err != nil {
			log.Errorf("Failed to get user %s: %v", requesterUserID.String(), err)
			return
		}
		data := webhooks_service.WebhookData{
			Title:       "Project Updated",
			Url:         url,
			Description: fmt.Sprintf("A project has been updated in team %s by %s", project.Edges.Team.Name, user.Email),
			Fields:      []webhooks_service.WebhookDataField{},
		}

		if input.DefaultEnvironmentID != nil {
			env, err := self.repo.Environment().GetByID(context.Background(), *input.DefaultEnvironmentID)
			if err != nil {
				log.Warnf("Failed to get environment %s: %v", input.DefaultEnvironmentID.String(), err)
			} else {
				data.Fields = append(data.Fields, webhooks_service.WebhookDataField{
					Name:  "Default Environment",
					Value: env.Name,
				})
			}
		}

		if input.Name != "" {
			data.Fields = append(data.Fields, webhooks_service.WebhookDataField{
				Name:  "Name",
				Value: input.Name,
			})
		}

		if input.Description != nil {
			data.Fields = append(data.Fields, webhooks_service.WebhookDataField{
				Name:  "Description",
				Value: *input.Description,
			})
		}

		if err := self.webhookService.TriggerWebhooks(context.Background(), level, event, data); err != nil {
			log.Errorf("Failed to trigger webhook %s: %v", event, err)
		}
	}()

	permSet, err := self.repo.Permissions().GetUserPermissionSet(ctx, requesterUserID)
	if err != nil {
		return nil, err
	}

	resp := models.TransformProjectEntity(project)
	resp.Permissions = permSet.ProjectActions(input.TeamID, project.ID)
	for _, environment := range resp.Environments {
		environment.Permissions = permSet.EnvironmentActions(input.TeamID, project.ID, environment.ID)
	}

	return resp, nil
}
