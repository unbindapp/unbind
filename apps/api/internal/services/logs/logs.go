package logs_service

import (
	"context"
	"fmt"
	"strings"
	"time"

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

type logFilters struct {
	compiledSearch string
	levels         []loki.LogLevel
	serviceIDs     []string
}

func parseLogFilters(logType models.LogType, search, levelsCSV, serviceIDsCSV string) (logFilters, error) {
	var filters logFilters

	compiled, err := loki.CompileSearch(search)
	if err != nil {
		return filters, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("invalid search expression: %v", err))
	}
	filters.compiledSearch = compiled

	if levelsCSV != "" {
		seen := make(map[loki.LogLevel]bool, len(loki.LogLevelValues))
		for _, part := range strings.Split(levelsCSV, ",") {
			level, ok := loki.ParseLogLevel(part)
			if !ok {
				return filters, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("invalid log level %q", part))
			}
			if seen[level] {
				continue
			}
			seen[level] = true
			filters.levels = append(filters.levels, level)
		}
		// selecting every level is the same as not filtering
		if len(filters.levels) == len(loki.LogLevelValues) {
			filters.levels = nil
		}
	}

	if serviceIDsCSV != "" {
		if logType != models.LogTypeTeam && logType != models.LogTypeProject && logType != models.LogTypeEnvironment {
			return filters, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "service_ids is only valid for team, project, or environment logs")
		}
		for _, part := range strings.Split(serviceIDsCSV, ",") {
			id, err := uuid.Parse(strings.TrimSpace(part))
			if err != nil {
				return filters, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("invalid service id %q", part))
			}
			filters.serviceIDs = append(filters.serviceIDs, id.String())
		}
	}

	return filters, nil
}

type lokiSelector struct {
	label      loki.LokiLabelName
	labelValue string
	startBound *time.Time
}

func (self *LogsService) resolveLokiSelector(ctx context.Context, logType models.LogType, deploymentID uuid.UUID, team *ent.Team, project *ent.Project, environment *ent.Environment, service *ent.Service) (lokiSelector, error) {
	switch logType {
	case models.LogTypeTeam:
		return lokiSelector{label: loki.LokiLabelTeam, labelValue: team.ID.String()}, nil
	case models.LogTypeProject:
		return lokiSelector{label: loki.LokiLabelProject, labelValue: project.ID.String()}, nil
	case models.LogTypeEnvironment:
		return lokiSelector{label: loki.LokiLabelEnvironment, labelValue: environment.ID.String()}, nil
	case models.LogTypeService:
		return lokiSelector{label: loki.LokiLabelService, labelValue: service.ID.String()}, nil
	case models.LogTypeDeployment, models.LogTypeBuild:
		deployment, err := self.repo.Deployment().GetByID(ctx, deploymentID)
		if err != nil {
			if ent.IsNotFound(err) {
				return lokiSelector{}, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Deployment not found")
			}
			return lokiSelector{}, err
		}

		// Validate that the deployment belongs to the level requested
		if err := self.validateDeploymentInput(ctx, deployment, service, environment, project, team); err != nil {
			return lokiSelector{}, err
		}

		if logType == models.LogTypeBuild {
			return lokiSelector{label: loki.LokiLabelBuild, labelValue: deployment.ID.String()}, nil
		}
		if service != nil && service.CurrentDeploymentID != nil && *service.CurrentDeploymentID == deployment.ID {
			// never-rolled pods keep the previous rollout's unbind-deployment label
			bound := deploymentLogStart(deployment)
			return lokiSelector{label: loki.LokiLabelService, labelValue: service.ID.String(), startBound: &bound}, nil
		}
		return lokiSelector{label: loki.LokiLabelDeployment, labelValue: deployment.ID.String()}, nil
	default:
		return lokiSelector{}, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "invalid log type")
	}
}

func deploymentLogStart(d *ent.Deployment) time.Time {
	switch {
	case d.StartedAt != nil:
		return *d.StartedAt
	case d.QueuedAt != nil:
		return *d.QueuedAt
	default:
		return d.CreatedAt
	}
}

// mirrors loki precedence: since only applies when start is unset
func clampLogStart(start time.Time, since time.Duration, bound *time.Time) (time.Time, time.Duration) {
	if bound == nil {
		return start, since
	}
	floor := *bound
	if start.IsZero() && since > 0 {
		if sinceStart := time.Now().Add(-since); sinceStart.After(floor) {
			floor = sinceStart
		}
	}
	if start.IsZero() || start.Before(floor) {
		start = floor
	}
	return start, 0
}

func (self *LogsService) validateDeploymentInput(ctx context.Context, deployment *ent.Deployment, service *ent.Service, environment *ent.Environment, project *ent.Project, team *ent.Team) error {
	// Validation
	validDeployment := false
	var err error
	switch {
	case service != nil:
		validDeployment = deployment.ServiceID == service.ID
	case environment != nil:
		validDeployment, err = self.repo.Deployment().ExistsInEnvironment(ctx, deployment.ID, environment.ID)
	case project != nil:
		validDeployment, err = self.repo.Deployment().ExistsInProject(ctx, deployment.ID, project.ID)
	case team != nil:
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
