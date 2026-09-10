package replica_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
)

// Integrate replica (pod) management with internal permissions and kubernetes RBAC
type ReplicaService struct {
	cfg  *config.Config
	repo repositories.RepositoriesInterface
	k8s  k8s.KubeClientInterface
}

func NewReplicaService(cfg *config.Config, repo repositories.RepositoriesInterface, k8s k8s.KubeClientInterface) *ReplicaService {
	return &ReplicaService{
		cfg:  cfg,
		repo: repo,
		k8s:  k8s,
	}
}

func (self *ReplicaService) validatePermissionsAndParseInputs(ctx context.Context, requesterUserID uuid.UUID, replicaType models.ReplicaType, teamID, projectID, environmentID, serviceID uuid.UUID) (*ent.Team, *ent.Project, *ent.Environment, *ent.Service, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		//Can read team, project, environmnent, or service depending on inputs
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   teamID,
		},
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeProject,
			ResourceID:   projectID,
		},
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeEnvironment,
			ResourceID:   environmentID,
		},
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeService,
			ResourceID:   serviceID,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, nil, nil, nil, errdefs.MaskAsNotFound(err, "Resource not found")
	}

	team, err := self.repo.Team().GetByID(ctx, teamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, nil, nil, nil, err
	}

	var project *ent.Project
	if replicaType == models.ReplicaTypeProject ||
		replicaType == models.ReplicaTypeEnvironment ||
		replicaType == models.ReplicaTypeService {
		project, err = self.repo.Project().GetByID(ctx, projectID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found")
			}
			return nil, nil, nil, nil, err
		}
		if project.TeamID != teamID {
			return nil, nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found in this team")
		}
	}

	var environment *ent.Environment
	if replicaType == models.ReplicaTypeEnvironment ||
		replicaType == models.ReplicaTypeService {
		environment, err = self.repo.Environment().GetByID(ctx, environmentID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Environment not found")
			}
			return nil, nil, nil, nil, err
		}
		if environment.ProjectID != projectID {
			return nil, nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Environment not found in this project")
		}
	}

	var service *ent.Service
	if replicaType == models.ReplicaTypeService {
		service, err = self.repo.Service().GetByID(ctx, serviceID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found")
			}
			return nil, nil, nil, nil, err
		}
		if service.EnvironmentID != environmentID {
			return nil, nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found in this environment")
		}
	}

	return team, project, environment, service, nil
}
