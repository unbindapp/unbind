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
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	environment_service "github.com/unbindapp/unbind-api/internal/services/environment"
	webhooks_service "github.com/unbindapp/unbind-api/internal/services/webooks"
	"k8s.io/apimachinery/pkg/api/errors"
)

type DeleteProjectInput struct {
	TeamID    uuid.UUID `format:"uuid" required:"true"`
	ProjectID uuid.UUID `format:"uuid" required:"true"`
}

func (self *ProjectService) DeleteProject(ctx context.Context, requesterUserID uuid.UUID, input *DeleteProjectInput) error {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to delete system resources
		{
			Action:       schema.ActionAdmin,
			ResourceType: schema.ResourceTypeProject,
			ResourceID:   input.ProjectID,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return err
	}

	team, err := self.repo.Team().GetByID(ctx, input.TeamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return err
	}

	// Make sure project exists and is in the team
	var project *ent.Project
	for _, p := range team.Edges.Projects {
		if p.ID == input.ProjectID {
			project = p
			break
		}
	}
	if project == nil {
		return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found")
	}

	environments, err := self.repo.Environment().GetForProject(ctx, nil, input.ProjectID, nil)
	if err != nil {
		return err
	}

	client := self.k8s.GetInternalClient()

	// Delete the project in cascading fashion
	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		for _, environment := range environments {
			if err := environment_service.Teardown(ctx, tx, self.repo, self.k8s, self.deployCtl, client, team.Namespace, environment, environment.Edges.Services); err != nil {
				return err
			}
		}

		// Delete project secret
		if err := self.k8s.DeleteSecret(ctx, project.KubernetesSecret, team.Namespace, client); err != nil && !errors.IsNotFound(err) {
			return err
		}

		if err := self.repo.Project().Delete(ctx, tx, input.ProjectID); err != nil {
			return err
		}

		return nil
	}); err != nil {
		return err
	}

	// Trigger webhook
	go func() {
		event := schema.WebhookEventProjectDeleted
		level := webhooks_service.WebhookLevelError

		url, _ := utils.JoinURLPaths(self.cfg.ExternalUIUrl, project.TeamID.String())
		user, err := self.repo.User().GetByID(context.Background(), requesterUserID)
		if err != nil {
			log.Errorf("Failed to get user %s: %v", requesterUserID.String(), err)
			return
		}
		data := webhooks_service.WebhookData{
			Title:       "Project Deleted",
			Url:         url,
			Description: fmt.Sprintf("A project has been deleted in team %s by %s", team.Name, user.Email),
			Fields: []webhooks_service.WebhookDataField{
				{
					Name:  "Project",
					Value: project.Name,
				},
			},
		}

		if project.Description != nil {
			data.Fields = append(data.Fields, webhooks_service.WebhookDataField{
				Name:  "Description",
				Value: *project.Description,
			})
		}

		if err := self.webhookService.TriggerWebhooks(context.Background(), level, event, data); err != nil {
			log.Errorf("Failed to trigger webhook %s: %v", event, err)
		}
	}()

	return nil
}
