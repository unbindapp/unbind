package variables_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
)

// Integrate variables management with internal permissions and kubernetes RBAC
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i VariablesServiceInterface -p variables_service -s VariablesService -o variables_service_iface.go
type VariablesService struct {
	repo repositories.RepositoriesInterface
	k8s  k8s.KubeClientInterface
}

func NewVariablesService(repo repositories.RepositoriesInterface, k8s k8s.KubeClientInterface) *VariablesService {
	return &VariablesService{
		repo: repo,
		k8s:  k8s,
	}
}

func (self *VariablesService) validateInputs(ctx context.Context, teamID, projectID, environmentID, serviceID uuid.UUID) (*ent.Team, *ent.Project, *ent.Environment, *ent.Service, error) {
	// Get available variable references
	service, err := self.repo.Service().GetByID(ctx, serviceID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found")
		}
		return nil, nil, nil, nil, err
	}

	environment := service.Edges.Environment
	project := environment.Edges.Project
	team := project.Edges.Team
	if team.ID != teamID ||
		project.ID != projectID ||
		environment.ID != environmentID {
		return nil, nil, nil, nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found")
	}

	return team, project, environment, service, nil
}

func (self *VariablesService) validateBaseInputs(ctx context.Context, variableType schema.VariableReferenceSourceType, teamID, projectID, environmentID, serviceID uuid.UUID) (*ent.Team, *ent.Project, *ent.Environment, *ent.Service, string, error) {
	if teamID == uuid.Nil {
		return nil, nil, nil, nil, "", errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Team ID is required")
	}
	switch variableType {
	case schema.VariableReferenceSourceTypeTeam:
		team, err := self.repo.Team().GetByID(ctx, teamID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, nil, nil, nil, "", errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
			}
			return nil, nil, nil, nil, "", err
		}
		return team, nil, nil, nil, team.KubernetesSecret, nil
	case schema.VariableReferenceSourceTypeProject:
		if projectID == uuid.Nil {
			return nil, nil, nil, nil, "", errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Project ID is required")
		}

		// Get project
		project, err := self.repo.Project().GetByID(ctx, projectID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, nil, nil, nil, "", errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Project not found")
			}
			return nil, nil, nil, nil, "", err
		}

		if project.TeamID != teamID {
			return nil, nil, nil, nil, "", errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Project not found")
		}

		return project.Edges.Team, project, nil, nil, project.KubernetesSecret, nil
	case schema.VariableReferenceSourceTypeEnvironment:
		if environmentID == uuid.Nil || projectID == uuid.Nil {
			return nil, nil, nil, nil, "", errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Project ID and Environment ID are required")
		}

		// Get environment
		environment, err := self.repo.Environment().GetByID(ctx, environmentID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, nil, nil, nil, "", errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Environment not found")
			}
			return nil, nil, nil, nil, "", err
		}

		if environment.ProjectID != projectID || environment.Edges.Project.TeamID != teamID {
			return nil, nil, nil, nil, "", errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Environment not found")
		}

		return environment.Edges.Project.Edges.Team, environment.Edges.Project, environment, nil, environment.KubernetesSecret, nil
	case schema.VariableReferenceSourceTypeService:
		if serviceID == uuid.Nil || environmentID == uuid.Nil || projectID == uuid.Nil {
			return nil, nil, nil, nil, "", errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Project ID, Environment ID and Service ID are required")
		}

		// Get service
		service, err := self.repo.Service().GetByID(ctx, serviceID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, nil, nil, nil, "", errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found")
			}
			return nil, nil, nil, nil, "", err
		}

		if service.EnvironmentID != environmentID ||
			service.Edges.Environment.ProjectID != projectID ||
			service.Edges.Environment.Edges.Project.TeamID != teamID {
			return nil, nil, nil, nil, "", errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Service not found")
		}

		return service.Edges.Environment.Edges.Project.Edges.Team, service.Edges.Environment.Edges.Project, service.Edges.Environment, service, service.KubernetesSecret, nil
	default:
		return nil, nil, nil, nil, "", errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Invalid variable type")
	}
}
