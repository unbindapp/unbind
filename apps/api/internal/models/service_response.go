package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

// ServiceResponse defines the response structure for service operations
type ServiceResponse struct {
	ID                       uuid.UUID                `json:"id" format:"uuid"`
	Type                     schema.ServiceType       `json:"type"`
	KubernetesName           string                   `json:"kubernetes_name"`
	Name                     string                   `json:"name"`
	Description              string                   `json:"description"`
	EnvironmentID            uuid.UUID                `json:"environment_id" format:"uuid"`
	GitHubInstallationID     *int64                   `json:"github_installation_id,omitempty"`
	GitRepository            *string                  `json:"git_repository,omitempty"`
	GitRepositoryOwner       *string                  `json:"git_repository_owner,omitempty"`
	CreatedAt                time.Time                `json:"created_at"`
	UpdatedAt                time.Time                `json:"updated_at"`
	CurrentDeployment        *DeploymentResponse      `json:"current_deployment,omitempty"`
	LastDeployment           *DeploymentResponse      `json:"last_deployment,omitempty"`
	LastSuccessfulDeployment *DeploymentResponse      `json:"last_successful_deployment,omitempty"`
	Config                   *ServiceConfigResponse   `json:"config"`
	DatabaseVersion          *string                  `json:"database_version,omitempty"`
	DatabaseType             *string                  `json:"database_type,omitempty"`
	Template                 *TemplateShortResponse   `json:"template,omitempty"`
	TemplateInstanceID       *uuid.UUID               `json:"template_instance_id,omitempty" format:"uuid"`
	ServiceGroup             *ServiceGroupResponse    `json:"service_group,omitempty"`
	DetectedPorts            []schema.PortSpec        `json:"detected_ports" nullable:"false"`
	Permissions              []schema.PermittedAction `json:"permissions" nullable:"false" doc:"Actions the current user can perform on this resource"`
}

// TransformServiceEntity transforms an ent.Service entity into a ServiceResponse
func TransformServiceEntity(entity *ent.Service) *ServiceResponse {
	response := &ServiceResponse{
		DetectedPorts: []schema.PortSpec{},
		Permissions:   []schema.PermittedAction{},
	}
	if entity != nil {
		response = &ServiceResponse{
			ID:                   entity.ID,
			Type:                 entity.Type,
			KubernetesName:       entity.KubernetesName,
			Name:                 entity.Name,
			Description:          entity.Description,
			EnvironmentID:        entity.EnvironmentID,
			GitHubInstallationID: entity.GithubInstallationID,
			GitRepository:        entity.GitRepository,
			GitRepositoryOwner:   entity.GitRepositoryOwner,
			CreatedAt:            entity.CreatedAt,
			UpdatedAt:            entity.UpdatedAt,
			DatabaseVersion:      entity.DatabaseVersion,
			DatabaseType:         entity.Database,
			Config:               TransformServiceConfigEntity(entity.Edges.ServiceConfig),
			TemplateInstanceID:   entity.TemplateInstanceID,
			DetectedPorts:        []schema.PortSpec{},
			Permissions:          []schema.PermittedAction{},
		}

		if entity.DetectedPorts != nil {
			response.DetectedPorts = entity.DetectedPorts
		}

		if entity.Edges.ServiceGroup != nil {
			response.ServiceGroup = TransformServiceGroupEntity(entity.Edges.ServiceGroup)
		}

		if entity.Edges.Template != nil {
			response.Template = TransformTemplateShortEntity(entity.Edges.Template)
		}

		if entity.Edges.CurrentDeployment != nil {
			response.CurrentDeployment = TransformDeploymentEntity(entity.Edges.CurrentDeployment)
		}

		if lastDeployment := lastDeployment(entity); lastDeployment != nil {
			response.LastDeployment = TransformDeploymentEntity(lastDeployment)
		}
		if lastSuccessfulDeployment := lastSuccessfulDeployment(entity); lastSuccessfulDeployment != nil {
			response.LastSuccessfulDeployment = TransformDeploymentEntity(lastSuccessfulDeployment)
		}
	}
	return response
}

// lastDeployment is the newest deployment, unless a newer rollout went live after it finished
func lastDeployment(entity *ent.Service) *ent.Deployment {
	var last *ent.Deployment
	for _, deployment := range entity.Edges.Deployments {
		if last == nil || deployment.CreatedAt.After(last.CreatedAt) {
			last = deployment
		}
	}

	current := entity.Edges.CurrentDeployment
	if last == nil || current == nil || last.ID == current.ID || last.Status != schema.DeploymentStatusBuildSucceeded {
		return last
	}
	return current
}

// lastSuccessfulDeployment is the one that went live most recently, which is the current one when it is still up
func lastSuccessfulDeployment(entity *ent.Service) *ent.Deployment {
	current := entity.Edges.CurrentDeployment
	if current != nil && current.Status == schema.DeploymentStatusBuildSucceeded {
		return current
	}

	var last *ent.Deployment
	for _, deployment := range entity.Edges.Deployments {
		if deployment.Status != schema.DeploymentStatusBuildSucceeded {
			continue
		}
		if last == nil || deployment.CreatedAt.After(last.CreatedAt) {
			last = deployment
		}
	}
	return last
}

// TransformServiceEntities transforms a slice of ent.Service entities into a slice of ServiceResponse
func TransformServiceEntities(entities []*ent.Service) []*ServiceResponse {
	responses := make([]*ServiceResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformServiceEntity(entity)
	}
	return responses
}
