package metric_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/infrastructure/prometheus"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
)

// Integrate metrics management with internal permissions and kubernetes RBAC
type MetricsService struct {
	promClient *prometheus.PrometheusClient
	repo       repositories.RepositoriesInterface
	k8s        k8s.KubeClientInterface
}

func NewMetricService(promClient *prometheus.PrometheusClient, repo repositories.RepositoriesInterface, k8s k8s.KubeClientInterface) *MetricsService {
	return &MetricsService{
		promClient: promClient,
		repo:       repo,
		k8s:        k8s,
	}
}

func (self *MetricsService) validatePermissionsAndParseInputs(ctx context.Context, requesterUserID uuid.UUID, input *models.MetricsQueryInput) (*ent.Team, *ent.Project, *ent.Environment, *ent.Service, error) {
	permissionCheck, err := permissionCheckForType(input)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{permissionCheck}); err != nil {
		return nil, nil, nil, nil, errdefs.MaskAsNotFound(err, "Resource not found")
	}

	team, err := self.repo.Team().GetByID(ctx, input.TeamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, nil, nil, nil, err
	}

	var project *ent.Project
	if input.Type == models.MetricsTypeProject ||
		input.Type == models.MetricsTypeEnvironment ||
		input.Type == models.MetricsTypeService {
		// validate project ID
		project, err = self.repo.Project().GetByID(ctx, input.ProjectID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found")
			}
			return nil, nil, nil, nil, err
		}
		if project.TeamID != input.TeamID {
			return nil, nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found in this team")
		}
	}

	var environment *ent.Environment
	if input.Type == models.MetricsTypeEnvironment ||
		input.Type == models.MetricsTypeService {
		// validate environment ID
		environment, err = self.repo.Environment().GetByID(ctx, input.EnvironmentID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Environment not found")
			}
			return nil, nil, nil, nil, err
		}
		if environment.ProjectID != input.ProjectID {
			return nil, nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Environment not found in this project")
		}
	}

	var service *ent.Service
	if input.Type == models.MetricsTypeService {
		service, err = self.repo.Service().GetByID(ctx, input.ServiceID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found")
			}
			return nil, nil, nil, nil, err
		}
		if service.EnvironmentID != input.EnvironmentID {
			return nil, nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found in this environment")
		}
	}

	return team, project, environment, service, nil
}

// Parent permissions flow down through the hierarchy, so only the requested level is checked.
func permissionCheckForType(input *models.MetricsQueryInput) (permissions_repo.PermissionCheck, error) {
	check := permissions_repo.PermissionCheck{Action: schema.ActionViewer}

	switch input.Type {
	case models.MetricsTypeTeam:
		check.ResourceType = schema.ResourceTypeTeam
		check.ResourceID = input.TeamID
	case models.MetricsTypeProject:
		check.ResourceType = schema.ResourceTypeProject
		check.ResourceID = input.ProjectID
	case models.MetricsTypeEnvironment:
		check.ResourceType = schema.ResourceTypeEnvironment
		check.ResourceID = input.EnvironmentID
	case models.MetricsTypeService:
		check.ResourceType = schema.ResourceTypeService
		check.ResourceID = input.ServiceID
	default:
		return check, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Invalid metrics type")
	}

	if check.ResourceID == uuid.Nil {
		return check, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("%s_id is required for type %s", input.Type, input.Type))
	}

	return check, nil
}
