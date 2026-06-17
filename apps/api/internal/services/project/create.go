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
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	webhooks_service "github.com/unbindapp/unbind-api/internal/services/webooks"
)

type CreateProjectInput struct {
	TeamID      uuid.UUID `json:"team_id" format:"uuid" required:"true"`
	Name        string    `json:"name" required:"true"`
	Description *string   `json:"description" required:"false"`
}

func (self *ProjectService) CreateProject(ctx context.Context, requesterUserID uuid.UUID, input *CreateProjectInput, bearerToken string) (*models.ProjectResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Team editor can create projects
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   input.TeamID,
		},
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Check if the team exists
	team, err := self.repo.Team().GetByID(ctx, input.TeamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, err
	}

	// Create kubernetes client
	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}

	// Create the project
	var project *ent.Project
	var environment *ent.Environment
	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		// Create a unique name
		kubernetesName, err := utils.GenerateSlug(input.Name)
		if err != nil {
			log.Errorf("Failed to generate kubernetes name for project %s: %v", input.Name, err)
			return err
		}

		// Create secret for this project
		secret, _, err := self.k8s.GetOrCreateSecret(ctx, kubernetesName, team.Namespace, client)
		if err != nil {
			return err
		}

		project, err = self.repo.Project().Create(ctx, tx, input.TeamID, kubernetesName, input.Name, input.Description, secret.Name)
		if err != nil {
			return err
		}

		defaultEnvName := "production"
		defaultEnvDescription := "Default production environment"
		// Create a default environment
		name, err := utils.GenerateSlug(defaultEnvName)
		if err != nil {
			return err
		}
		// Create secret for this environment
		secret, _, err = self.k8s.GetOrCreateSecret(ctx, name, team.Namespace, client)
		if err != nil {
			return err
		}

		environment, err = self.repo.Environment().Create(ctx, tx, name, defaultEnvName, secret.Name, &defaultEnvDescription, project.ID)
		if err != nil {
			return err
		}

		// Set as default
		project, err = self.repo.Project().Update(ctx, tx, project.ID, utils.ToPtr(environment.ID), input.Name, nil)
		if err != nil {
			return err
		}

		project.Edges.Environments = append(project.Edges.Environments, environment)
		return nil
	}); err != nil {
		return nil, err
	}

	// Trigger webhook
	go func() {
		event := schema.WebhookEventProjectCreated
		level := webhooks_service.WebhookLevelInfo

		// Get project with edges
		project, err := self.repo.Project().GetByID(context.Background(), project.ID)
		if err != nil {
			log.Errorf("Failed to get project %s: %v", project.ID.String(), err)
			return
		}

		// Construct URL
		url, _ := utils.JoinURLPaths(self.cfg.ExternalUIUrl, project.TeamID.String(), "project", project.ID.String())
		// Get user
		user, err := self.repo.User().GetByID(context.Background(), requesterUserID)
		if err != nil {
			log.Errorf("Failed to get user %s: %v", requesterUserID.String(), err)
			return
		}
		data := webhooks_service.WebhookData{
			Title:       "Project Created",
			Url:         url,
			Description: fmt.Sprintf("A new project has been created in team %s by %s", project.Edges.Team.Name, user.Email),
			Fields: []webhooks_service.WebhookDataField{
				{
					Name:  "Project Name",
					Value: project.Name,
				},
			},
		}

		if err := self.webhookService.TriggerWebhooks(context.Background(), level, event, data); err != nil {
			log.Errorf("Failed to trigger webhook %s: %v", event, err)
		}
	}()

	return models.TransformProjectEntity(project), nil
}
