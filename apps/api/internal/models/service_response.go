package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
)

// ServiceResponse defines the response structure for service operations
type ServiceResponse struct {
	ID                       uuid.UUID              `json:"id"`
	Type                     schema.ServiceType     `json:"type"`
	KubernetesName           string                 `json:"kubernetes_name"`
	Name                     string                 `json:"name"`
	Description              string                 `json:"description"`
	EnvironmentID            uuid.UUID              `json:"environment_id"`
	GitHubInstallationID     *int64                 `json:"github_installation_id,omitempty"`
	GitRepository            *string                `json:"git_repository,omitempty"`
	GitRepositoryOwner       *string                `json:"git_repository_owner,omitempty"`
	CreatedAt                time.Time              `json:"created_at"`
	UpdatedAt                time.Time              `json:"updated_at"`
	CurrentDeployment        *DeploymentResponse    `json:"current_deployment,omitempty"`
	LastDeployment           *DeploymentResponse    `json:"last_deployment,omitempty"`
	LastSuccessfulDeployment *DeploymentResponse    `json:"last_successful_deployment,omitempty"`
	Config                   *ServiceConfigResponse `json:"config"`
	DatabaseVersion          *string                `json:"database_version,omitempty"`
	DatabaseType             *string                `json:"database_type,omitempty"`
	Template                 *TemplateShortResponse `json:"template,omitempty"`
	TemplateInstanceID       *uuid.UUID             `json:"template_instance_id,omitempty"`
	ServiceGroup             *ServiceGroupResponse  `json:"service_group,omitempty"`
	DetectedPorts            []schema.PortSpec      `json:"detected_ports" nullable:"false"`
}

// TransformServiceEntity transforms an ent.Service entity into a ServiceResponse
func TransformServiceEntity(entity *ent.Service) *ServiceResponse {
	response := &ServiceResponse{
		DetectedPorts: []schema.PortSpec{},
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

		if len(entity.Edges.Deployments) > 0 {
			var lastDeployment *ent.Deployment
			var lastSuccessfulDeployment *ent.Deployment
			for _, deployment := range entity.Edges.Deployments {
				if lastDeployment == nil || deployment.CreatedAt.After(lastDeployment.CreatedAt) {
					lastDeployment = deployment
				}
				if deployment.Status == schema.DeploymentStatusBuildSucceeded {
					if lastSuccessfulDeployment == nil || deployment.CreatedAt.After(lastSuccessfulDeployment.CreatedAt) {
						lastSuccessfulDeployment = deployment
					}
				}
			}
			if lastDeployment != nil {
				response.LastDeployment = TransformDeploymentEntity(lastDeployment)
			}
			if lastSuccessfulDeployment != nil {
				response.LastSuccessfulDeployment = TransformDeploymentEntity(lastSuccessfulDeployment)
			}
		}
	}
	return response
}

// TransformServiceEntities transforms a slice of ent.Service entities into a slice of ServiceResponse
func TransformServiceEntities(entities []*ent.Service) []*ServiceResponse {
	responses := make([]*ServiceResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformServiceEntity(entity)
	}
	return responses
}
