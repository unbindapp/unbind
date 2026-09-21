package replica_service

import (
	"context"
	"fmt"

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
	permissionCheck, err := permissionCheckForType(replicaType, teamID, projectID, environmentID, serviceID)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{permissionCheck}); err != nil {
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

// Parent permissions flow down through the hierarchy, so only the requested level is checked.
func permissionCheckForType(replicaType models.ReplicaType, teamID, projectID, environmentID, serviceID uuid.UUID) (permissions_repo.PermissionCheck, error) {
	check := permissions_repo.PermissionCheck{Action: schema.ActionViewer}

	switch replicaType {
	case models.ReplicaTypeTeam:
		check.ResourceType = schema.ResourceTypeTeam
		check.ResourceID = teamID
	case models.ReplicaTypeProject:
		check.ResourceType = schema.ResourceTypeProject
		check.ResourceID = projectID
	case models.ReplicaTypeEnvironment:
		check.ResourceType = schema.ResourceTypeEnvironment
		check.ResourceID = environmentID
	case models.ReplicaTypeService:
		check.ResourceType = schema.ResourceTypeService
		check.ResourceID = serviceID
	default:
		return check, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Invalid replica type")
	}

	if check.ResourceID == uuid.Nil {
		return check, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("%s_id is required for type %s", replicaType, replicaType))
	}

	return check, nil
}
