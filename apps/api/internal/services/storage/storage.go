package storage_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/infrastructure/prometheus"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	service_service "github.com/unbindapp/unbind-api/internal/services/service"
)

// Integrate storage management with internal permissions and kubernetes RBAC
type StorageService struct {
	cfg        *config.Config
	repo       repositories.RepositoriesInterface
	k8s        k8s.KubeClientInterface
	promClient *prometheus.PrometheusClient
	svcService *service_service.ServiceService
}

func NewStorageService(cfg *config.Config, repo repositories.RepositoriesInterface, k8sClient k8s.KubeClientInterface, promClient *prometheus.PrometheusClient, svcService *service_service.ServiceService) *StorageService {
	return &StorageService{
		cfg:        cfg,
		repo:       repo,
		k8s:        k8sClient,
		promClient: promClient,
		svcService: svcService,
	}
}

func (self *StorageService) validatePermissionsAndParseInputs(ctx context.Context, action schema.PermittedAction, requesterUserID uuid.UUID, pvcScope models.PvcScope, teamID, projectID, environmentID uuid.UUID) (*ent.Team, *ent.Project, *ent.Environment, error) {
	permissionCheck, err := permissionCheckForScope(action, pvcScope, teamID, projectID, environmentID)
	if err != nil {
		return nil, nil, nil, err
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{permissionCheck}); err != nil {
		if action == schema.ActionViewer {
			return nil, nil, nil, errdefs.MaskAsNotFound(err, "Resource not found")
		}
		return nil, nil, nil, err
	}

	team, err := self.repo.Team().GetByID(ctx, teamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, nil, nil, err
	}

	var project *ent.Project
	if pvcScope == models.PvcScopeProject ||
		pvcScope == models.PvcScopeEnvironment {
		// validate project ID
		project, err = self.repo.Project().GetByID(ctx, projectID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found")
			}
			return nil, nil, nil, err
		}
		if project.TeamID != teamID {
			return nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found in this team")
		}
	}

	var environment *ent.Environment
	if pvcScope == models.PvcScopeEnvironment {
		// validate environment ID
		environment, err = self.repo.Environment().GetByID(ctx, environmentID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Environment not found")
			}
			return nil, nil, nil, err
		}
		if environment.ProjectID != projectID {
			return nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Environment not found in this project")
		}
	}

	return team, project, environment, nil
}

// Parent permissions flow down through the hierarchy, so only the requested level is checked.
func permissionCheckForScope(action schema.PermittedAction, pvcScope models.PvcScope, teamID, projectID, environmentID uuid.UUID) (permissions_repo.PermissionCheck, error) {
	check := permissions_repo.PermissionCheck{Action: action}

	switch pvcScope {
	case models.PvcScopeTeam:
		check.ResourceType = schema.ResourceTypeTeam
		check.ResourceID = teamID
	case models.PvcScopeProject:
		check.ResourceType = schema.ResourceTypeProject
		check.ResourceID = projectID
	case models.PvcScopeEnvironment:
		check.ResourceType = schema.ResourceTypeEnvironment
		check.ResourceID = environmentID
	default:
		return check, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Invalid volume type")
	}

	if check.ResourceID == uuid.Nil {
		return check, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("%s_id is required for type %s", pvcScope, pvcScope))
	}

	return check, nil
}
