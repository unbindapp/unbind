package variables_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/vartemplate"
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

	// Services anywhere in the project can be referenced
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
				if otherService.ID == currentService.ID || !canView(schema.ResourceTypeService, otherService.ID) {
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

	var endpoints []models.AvailableVariableReference
	for _, otherService := range accessibleServices {
		base := models.AvailableVariableReference{
			SourceName:           otherService.Name,
			SourceIcon:           serviceIcon(otherService),
			SourceKubernetesName: otherService.KubernetesName,
			SourceType:           schema.VariableReferenceSourceTypeService,
			SourceID:             otherService.ID,
		}
		if keys := internalEndpointKeys(otherService); len(keys) > 0 {
			internal := base
			internal.Type = schema.VariableReferenceTypeInternalEndpoint
			internal.Keys = keys
			endpoints = append(endpoints, internal)
		}
		if keys := externalEndpointKeys(otherService); len(keys) > 0 {
			external := base
			external.Type = schema.VariableReferenceTypeExternalEndpoint
			external.Keys = keys
			endpoints = append(endpoints, external)
		}
	}

	return models.TransformAvailableVariableResponse(k8sSecrets, endpoints, kubernetesNameMap, nameMap, iconMap), nil
}

// Databases expose host and port separately since their URL lives in DATABASE_URL
func internalEndpointKeys(service *ent.Service) []string {
	if service.Type == schema.ServiceTypeDatabase {
		return []string{vartemplate.KeyInternalHost, vartemplate.KeyInternalPort}
	}
	ports := internalPortsFromConfig(service)
	keys := make([]string, 0, len(ports))
	for i := range ports {
		keys = append(keys, vartemplate.EndpointKey(vartemplate.KeyInternalURL, i+1))
	}
	return keys
}

func externalEndpointKeys(service *ent.Service) []string {
	hosts := externalHosts(service)
	keys := make([]string, 0, len(hosts))
	for i := range hosts {
		keys = append(keys, vartemplate.EndpointKey(vartemplate.KeyExternalURL, i+1))
	}
	return keys
}
