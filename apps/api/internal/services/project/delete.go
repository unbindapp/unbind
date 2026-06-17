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
	webhooks_service "github.com/unbindapp/unbind-api/internal/services/webooks"
)

type DeleteProjectInput struct {
	TeamID    uuid.UUID `format:"uuid" required:"true"`
	ProjectID uuid.UUID `format:"uuid" required:"true"`
}

func (self *ProjectService) DeleteProject(ctx context.Context, requesterUserID uuid.UUID, input *DeleteProjectInput, bearerToken string) error {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to delete system resources
		{
			Action:       schema.ActionAdmin,
			ResourceType: schema.ResourceTypeProject,
			ResourceID:   input.ProjectID,
		},
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return err
	}

	// Check if the team exists
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

	// Create kubernetes client
	k8sClient, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return err
	}

	environments, err := self.repo.Environment().GetForProject(ctx, nil, input.ProjectID, nil)
	if err != nil {
		return err
	}

	// Create kubernetes client
	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return err
	}

	// Delete the project in cascading fashion
	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		// Delete environments
		for _, environment := range environments {
			// Delete services
			for _, service := range environment.Edges.Services {
				// Cancel deployments
				if err := self.deployCtl.CancelExistingJobs(ctx, service.ID); err != nil {
					log.Warnf("Error cancelling jobs for service %s: %v", service.KubernetesName, err)
				}

				if err := self.k8s.DeleteUnbindService(ctx, team.Namespace, service.KubernetesName); err != nil {
					log.Error("Error deleting service from k8s", "svc", service.KubernetesName, "err", err)

					return err
				}

				// Delete secret
				if err := self.k8s.DeleteSecret(ctx, service.KubernetesSecret, team.Namespace, client); err != nil {
					log.Error("Error deleting secret from k8s", "secret", service.KubernetesSecret, "err", err)
					return err
				}

				if err := self.repo.Service().Delete(ctx, tx, service.ID); err != nil {
					return err
				}
			}

			// Delete any service groups in this environment
			if err := self.repo.ServiceGroup().DeleteByEnvironmentID(ctx, tx, environment.ID); err != nil {
				return err
			}

			// Delete environment
			if err := self.k8s.DeleteSecret(ctx, environment.KubernetesSecret, team.Namespace, client); err != nil {
				log.Error("Error deleting secret", "secret", environment.KubernetesSecret, "err", err)
			}

			if err := self.repo.Environment().Delete(ctx, tx, environment.ID); err != nil {
				return err
			}
		}

		// Delete project secret
		if err := self.k8s.DeleteSecret(ctx, project.KubernetesSecret, team.Namespace, k8sClient); err != nil {
			return err
		}

		// Delete project by ID
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

		// Construct URL
		url, _ := utils.JoinURLPaths(self.cfg.ExternalUIUrl, project.TeamID.String())
		// Get user
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
