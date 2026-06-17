package storage_service

import (
	"context"

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
	permissionChecks := []permissions_repo.PermissionCheck{
		//Can read team, project, environmnent depending on inputs
		{
			Action:       action,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   teamID,
		},
		{
			Action:       action,
			ResourceType: schema.ResourceTypeProject,
			ResourceID:   projectID,
		},
		{
			Action:       action,
			ResourceType: schema.ResourceTypeEnvironment,
			ResourceID:   environmentID,
		},
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, nil, nil, err
	}

	// Get namespace
	team, err := self.repo.Team().GetByID(ctx, teamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, nil, nil, err
	}

	// Get project
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

	// Get environment
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
