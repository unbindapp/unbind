package templates_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/deployctl"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	"github.com/unbindapp/unbind-api/pkg/databases"
)

// Integrate templates management with internal permissions and kubernetes RBAC
type TemplatesService struct {
	cfg        *config.Config
	repo       repositories.RepositoriesInterface
	k8s        k8s.KubeClientInterface
	dbProvider *databases.DatabaseProvider
	deployCtl  *deployctl.DeploymentController
}

func NewTemplatesService(cfg *config.Config, repo repositories.RepositoriesInterface, k8s k8s.KubeClientInterface, dbProvider *databases.DatabaseProvider, deployCtl *deployctl.DeploymentController) *TemplatesService {
	return &TemplatesService{
		cfg:        cfg,
		repo:       repo,
		k8s:        k8s,
		dbProvider: dbProvider,
		deployCtl:  deployCtl,
	}
}

func (self *TemplatesService) VerifyInputs(ctx context.Context, teamID, projectID, environmentID uuid.UUID) (*ent.Environment, *ent.Project, error) {
	// Verify that the environment exists
	environment, err := self.repo.Environment().GetByID(ctx, environmentID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Environment not found")
		}
		return nil, nil, err
	}

	if environment == nil {
		return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Environment not found")
	}

	if environment.Edges.Project == nil {
		return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Environment does not belong to a project")
	}

	if environment.Edges.Project.ID != projectID {
		return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Environment does not belong to the specified project")
	}

	if environment.Edges.Project.Edges.Team == nil {
		return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Environment does not belong to a team")
	}

	if environment.Edges.Project.Edges.Team.ID != teamID {
		return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Project does not belong to the specified team")
	}

	return environment, environment.Edges.Project, nil
}
