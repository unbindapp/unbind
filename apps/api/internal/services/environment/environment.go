package environment_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/deployctl"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
)

// Integrate environment management with internal permissions and kubernetes RBAC
type EnvironmentService struct {
	repo      repositories.RepositoriesInterface
	k8s       k8s.KubeClientInterface
	deployCtl deployctl.DeploymentControllerInterface
}

func NewEnvironmentService(repo repositories.RepositoriesInterface, k8sClient k8s.KubeClientInterface, deployCtl deployctl.DeploymentControllerInterface) *EnvironmentService {
	return &EnvironmentService{
		repo:      repo,
		k8s:       k8sClient,
		deployCtl: deployCtl,
	}
}

func (self *EnvironmentService) VerifyInputs(ctx context.Context, teamID, projectID, environmentID uuid.UUID) (*ent.Team, *ent.Environment, error) {
	// Check if the team exists
	team, err := self.repo.Team().GetByID(ctx, teamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, nil, err
	}

	var project *ent.Project
	for _, p := range team.Edges.Projects {
		if p.ID == projectID {
			project = p
			break
		}
	}
	if project == nil {
		return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found")
	}

	// Get environment
	var environment *ent.Environment
	for _, e := range project.Edges.Environments {
		if e.ID == environmentID {
			environment = e
			break
		}
	}
	if environment == nil {
		return nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Environment not found")
	}

	return team, environment, nil
}
