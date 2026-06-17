package environment_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

type CreateEnvironmentInput struct {
	TeamID      uuid.UUID `json:"team_id" format:"uuid" required:"true"`
	ProjectID   uuid.UUID `json:"project_id" format:"uuid" required:"true"`
	Name        string    `json:"name" required:"true"`
	Description *string   `json:"description"`
}

func (self *EnvironmentService) CreateEnvironment(ctx context.Context, requesterUserID uuid.UUID, input *CreateEnvironmentInput, bearerToken string) (*models.EnvironmentResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Project editor can create environments
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeProject,
			ResourceID:   input.ProjectID,
		},
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Check if the project exists
	project, err := self.repo.Project().GetByID(ctx, input.ProjectID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found")
		}
		return nil, err
	}
	team := project.Edges.Team

	// Create kubernetes client
	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}

	// Create the environment
	var environment *ent.Environment
	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		// Generate neme
		kubernetesName, err := utils.GenerateSlug(input.Name)
		if err != nil {
			return err
		}
		// Create secret for this project
		secret, _, err := self.k8s.GetOrCreateSecret(ctx, kubernetesName, team.Namespace, client)
		if err != nil {
			return err
		}

		environment, err = self.repo.Environment().Create(ctx, tx, kubernetesName, input.Name, secret.Name, input.Description, project.ID)
		if err != nil {
			return err
		}

		// See if the project has an environment already
		if project.DefaultEnvironmentID == nil {
			// Set this environment as the default
			_, err = self.repo.Project().Update(ctx, tx, project.ID, &environment.ID, "", nil)
			if err != nil {
				log.Warnf("Failed to set default environment for project %s: %s", project.ID, err)
			}
		}

		return nil
	}); err != nil {
		return nil, err
	}

	// Convert to response
	resp := models.TransformEnvironmentEntity(environment)

	// Summarizes services
	counts, providerSummaries, err := self.repo.Service().SummarizeServices(ctx, []uuid.UUID{environment.ID})
	if err != nil {
		return nil, err
	}
	resp.ServiceCount, _ = counts[environment.ID]
	resp.ServiceIcons, _ = providerSummaries[environment.ID]

	return resp, nil
}
