package logs_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/infrastructure/loki"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
)

// Integrate logs management with internal permissions and kubernetes RBAC
type LogsService struct {
	repo        repositories.RepositoriesInterface
	k8s         k8s.KubeClientInterface
	lokiQuerier *loki.LokiLogQuerier
}

func NewLogsService(repo repositories.RepositoriesInterface, k8sClient k8s.KubeClientInterface, lokiQuerier *loki.LokiLogQuerier) *LogsService {
	return &LogsService{
		repo:        repo,
		k8s:         k8sClient,
		lokiQuerier: lokiQuerier,
	}
}

func (self *LogsService) validatePermissionsAndParseInputs(ctx context.Context, requesterUserID uuid.UUID, logType models.LogType, teamID, projectID, environmentID, serviceID uuid.UUID) (*ent.Team, *ent.Project, *ent.Environment, *ent.Service, error) {
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

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, nil, nil, nil, err
	}

	// Get namespace
	team, err := self.repo.Team().GetByID(ctx, teamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, nil, nil, nil, err
	}

	// Get project
	var project *ent.Project
	if logType == models.LogTypeProject ||
		logType == models.LogTypeEnvironment ||
		logType == models.LogTypeService ||
		logType == models.LogTypeDeployment {
		// validate project ID
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

	// Get environment
	var environment *ent.Environment
	if logType == models.LogTypeEnvironment ||
		logType == models.LogTypeService ||
		logType == models.LogTypeDeployment {
		// validate environment ID
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

	// Get service
	var service *ent.Service
	if logType == models.LogTypeService || logType == models.LogTypeDeployment {
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

func (self *LogsService) validateDeploymentInput(ctx context.Context, deployment *ent.Deployment, service *ent.Service, environment *ent.Environment, project *ent.Project, team *ent.Team) error {
	// Validation
	validDeployment := false
	var err error
	if service != nil {
		if deployment.ServiceID == service.ID {
			validDeployment = true
		}
	} else if environment != nil {
		validDeployment, err = self.repo.Deployment().ExistsInEnvironment(ctx, deployment.ID, environment.ID)
	} else if project != nil {
		validDeployment, err = self.repo.Deployment().ExistsInProject(ctx, deployment.ID, project.ID)
	} else if team != nil {
		validDeployment, err = self.repo.Deployment().ExistsInTeam(ctx, deployment.ID, team.ID)
	}

	if err != nil || !validDeployment {
		if ent.IsNotFound(err) || !validDeployment {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Deployment not found")
		}
		return err
	}

	return nil
}
