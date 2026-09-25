package variables_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// GetAvailableVariableReferences lists the sources and keys a service's variables can reference
func (self *VariablesService) GetAvailableVariableReferences(ctx context.Context, requesterUserID uuid.UUID, teamID, projectID, environmentID, serviceID uuid.UUID) ([]models.AvailableVariableReference, error) {
	team, project, currentEnvironment, currentService, err := self.validateInputs(ctx, teamID, projectID, environmentID, serviceID)
	if err != nil {
		return nil, err
	}

	kubernetesNameMap := make(map[uuid.UUID]string)
	nameMap := make(map[uuid.UUID]string)
	iconMap := make(map[uuid.UUID]string)

	var teamSecret, projectSecret, environmentSecret string
	accessibleServiceSecrets := make(map[uuid.UUID]string)
	var accessibleServices []*ent.Service

	canView := func(resourceType schema.ResourceType, resourceID uuid.UUID) bool {
		return self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{{
			Action: schema.ActionViewer, ResourceType: resourceType, ResourceID: resourceID,
		}}) == nil
	}

	if canView(schema.ResourceTypeTeam, team.ID) {
		kubernetesNameMap[team.ID] = team.KubernetesName
		nameMap[team.ID] = team.Name
		iconMap[team.ID] = "team"
		teamSecret = team.KubernetesSecret
	}

	canViewProject := canView(schema.ResourceTypeProject, project.ID)
	if canViewProject {
		kubernetesNameMap[project.ID] = project.KubernetesName
		nameMap[project.ID] = project.Name
		iconMap[project.ID] = "project"
		projectSecret = project.KubernetesSecret
	}

	if canView(schema.ResourceTypeEnvironment, currentEnvironment.ID) {
		kubernetesNameMap[currentEnvironment.ID] = currentEnvironment.KubernetesName
		nameMap[currentEnvironment.ID] = currentEnvironment.Name
		iconMap[currentEnvironment.ID] = "environment"
		environmentSecret = currentEnvironment.KubernetesSecret
	}

	// Services anywhere in the project can be referenced, the current one included
	if canViewProject {
		projectEnvironments, err := self.repo.Environment().GetForProject(ctx, nil, project.ID, nil)
		if err != nil {
			log.Warnf("Failed to list environments in project %s for variable references: %v", project.ID, err)
		}
		for _, env := range projectEnvironments {
			if !canView(schema.ResourceTypeEnvironment, env.ID) {
				continue
			}
			environmentServices, err := self.repo.Service().GetByEnvironmentID(ctx, env.ID, nil, false)
			if err != nil {
				log.Warnf("Failed to list services in environment %s for variable references: %v", env.ID, err)
				continue
			}
			for _, otherService := range environmentServices {
				if !canView(schema.ResourceTypeService, otherService.ID) {
					continue
				}
				accessibleServiceSecrets[otherService.ID] = otherService.KubernetesSecret
				kubernetesNameMap[otherService.ID] = otherService.KubernetesName
				nameMap[otherService.ID] = otherService.Name
				iconMap[otherService.ID] = serviceIcon(otherService)
				accessibleServices = append(accessibleServices, otherService)
			}
		}
	}

	client := self.k8s.GetInternalClient()
	k8sSecrets, err := self.k8s.GetAllSecrets(ctx, team.ID, teamSecret, project.ID, projectSecret, currentEnvironment.ID, environmentSecret, accessibleServiceSecrets, client, team.Namespace)
	if err != nil {
		return nil, err
	}

	rc, err := self.newRenderContext(ctx, client, currentService, nil)
	if err != nil {
		return nil, err
	}

	var provided []models.AvailableVariableReference
	for _, otherService := range accessibleServices {
		provided = append(provided, rc.providedReferences(otherService)...)
	}

	return models.TransformAvailableVariableResponse(k8sSecrets, provided, kubernetesNameMap, nameMap, iconMap), nil
}
