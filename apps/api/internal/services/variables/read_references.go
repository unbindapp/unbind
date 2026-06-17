package variables_service

import (
	"context"
	"slices"
	"sync"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent" // For environment predicates if needed

	// For project predicates
	"github.com/unbindapp/unbind-api/ent/schema" // For service predicates
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *VariablesService) GetAvailableVariableReferences(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, teamID, projectID, environmentID, serviceID uuid.UUID) ([]models.AvailableVariableReference, error) {
	team, project, currentEnvironment, currentService, err := self.validateInputs(ctx, teamID, projectID, environmentID, serviceID)
	if err != nil {
		return nil, err
	}

	kubernetesNameMap := make(map[uuid.UUID]string)
	nameMap := make(map[uuid.UUID]string)
	iconMap := make(map[uuid.UUID]string)

	var teamSecret, projectSecret, environmentSecret string
	accessibleServiceSecrets := make(map[uuid.UUID]string)
	accessibleServiceIDs := []uuid.UUID{}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{{
		Action: schema.ActionViewer, ResourceType: schema.ResourceTypeTeam, ResourceID: team.ID,
	}}); err == nil {
		kubernetesNameMap[team.ID] = team.KubernetesName
		nameMap[team.ID] = team.Name
		iconMap[team.ID] = "team"
		teamSecret = team.KubernetesSecret
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{{
		Action: schema.ActionViewer, ResourceType: schema.ResourceTypeProject, ResourceID: project.ID,
	}}); err == nil {
		kubernetesNameMap[project.ID] = project.KubernetesName
		nameMap[project.ID] = project.Name
		iconMap[project.ID] = "project"
		projectSecret = project.KubernetesSecret
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{{
		Action: schema.ActionViewer, ResourceType: schema.ResourceTypeEnvironment, ResourceID: currentEnvironment.ID,
	}}); err == nil {
		kubernetesNameMap[currentEnvironment.ID] = currentEnvironment.KubernetesName
		nameMap[currentEnvironment.ID] = currentEnvironment.Name
		iconMap[currentEnvironment.ID] = "environment"
		environmentSecret = currentEnvironment.KubernetesSecret
	}

	// Accessible services in the same project
	if projectErr := self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{{
		Action: schema.ActionViewer, ResourceType: schema.ResourceTypeProject, ResourceID: project.ID,
	}}); projectErr == nil {
		// Fetch all environments for this project first
		projectEnvironments, err := self.repo.Environment().GetForProject(ctx, nil, project.ID, nil) // Passing nil for authPredicate as we check env access next
		if err != nil {
			log.Warnf("Failed to list environments in project %s for variable references: %v", project.ID, err)
		} else {
			for _, env := range projectEnvironments {
				// Check if user can view this specific environment
				if envViewErr := self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{{
					Action: schema.ActionViewer, ResourceType: schema.ResourceTypeEnvironment, ResourceID: env.ID,
				}}); envViewErr == nil {
					environmentServices, err := self.repo.Service().GetByEnvironmentID(ctx, env.ID, nil, true) // Pass nil for service auth predicate, check individually
					if err != nil {
						log.Warnf("Failed to list services in environment %s for variable references: %v", env.ID, err)
						continue
					}
					for _, otherService := range environmentServices {
						if otherService.ID == currentService.ID {
							continue
						}
						if err := self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{{
							Action: schema.ActionViewer, ResourceType: schema.ResourceTypeService, ResourceID: otherService.ID,
						}}); err == nil {
							accessibleServiceSecrets[otherService.ID] = otherService.KubernetesSecret
							kubernetesNameMap[otherService.ID] = otherService.KubernetesName
							nameMap[otherService.ID] = otherService.Name
							if otherService.Edges.ServiceConfig != nil {
								iconMap[otherService.ID] = otherService.Edges.ServiceConfig.Icon
							} else {
								iconMap[otherService.ID] = string(otherService.Type)
							}
							accessibleServiceIDs = append(accessibleServiceIDs, otherService.ID)
						}
					}
				}
			}
		}
	}

	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	var k8sSecrets []models.SecretData
	var endpoints *models.EndpointDiscovery
	var secretsErr, endpointsErr error

	wg.Add(2)

	go func() {
		defer wg.Done()
		secrets, sErr := self.k8s.GetAllSecrets(ctx, team.ID, teamSecret, project.ID, projectSecret, currentEnvironment.ID, environmentSecret, accessibleServiceSecrets, client, team.Namespace)
		mu.Lock()
		k8sSecrets = secrets
		secretsErr = sErr
		mu.Unlock()
	}()

	go func() {
		defer wg.Done()
		if environmentSecret == "" {
			mu.Lock()
			endpoints = &models.EndpointDiscovery{External: []models.IngressEndpoint{}, Internal: []models.ServiceEndpoint{}}
			mu.Unlock()
			return
		}
		eps, epErr := self.k8s.DiscoverEndpointsByLabels(ctx, team.Namespace, map[string]string{"unbind-environment": currentEnvironment.ID.String()}, false, client)
		mu.Lock()
		if epErr != nil {
			log.Errorf("Failed to discover endpoints: %v", epErr)
			endpoints = &models.EndpointDiscovery{External: []models.IngressEndpoint{}, Internal: []models.ServiceEndpoint{}}
			endpointsErr = epErr
		} else if eps != nil {
			filteredEPs := &models.EndpointDiscovery{Internal: []models.ServiceEndpoint{}, External: []models.IngressEndpoint{}}
			for _, ep := range eps.Internal {
				if ep.ServiceID != currentService.ID && slices.Contains(accessibleServiceIDs, ep.ServiceID) {
					filteredEPs.Internal = append(filteredEPs.Internal, ep)
				}
			}
			for _, ep := range eps.External {
				if ep.ServiceID != currentService.ID && slices.Contains(accessibleServiceIDs, ep.ServiceID) {
					filteredEPs.External = append(filteredEPs.External, ep)
				}
			}
			endpoints = filteredEPs
		} else {
			endpoints = &models.EndpointDiscovery{External: []models.IngressEndpoint{}, Internal: []models.ServiceEndpoint{}}
		}
		mu.Unlock()
	}()

	wg.Wait()

	if secretsErr != nil {
		return nil, secretsErr
	}
	if endpointsErr != nil {
		log.Warnf("Error discovering endpoints for variable references, proceeding without them: %v", endpointsErr)
		if endpoints == nil {
			endpoints = &models.EndpointDiscovery{External: []models.IngressEndpoint{}, Internal: []models.ServiceEndpoint{}}
		}
	}
	if endpoints == nil {
		endpoints = &models.EndpointDiscovery{External: []models.IngressEndpoint{}, Internal: []models.ServiceEndpoint{}}
	}

	return models.TransformAvailableVariableResponse(k8sSecrets, endpoints, kubernetesNameMap, nameMap, iconMap), nil
}

// Resolve a variable reference value for a key
func (self *VariablesService) ResolveAvailableReferenceValue(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, input *models.ResolveVariableReferenceInput) (string, error) {
	permissionChecks := []permissions_repo.PermissionCheck{}
	switch input.SourceType {
	case schema.VariableReferenceSourceTypeTeam:
		permissionChecks = append(permissionChecks, permissions_repo.PermissionCheck{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   input.SourceID,
		})
	case schema.VariableReferenceSourceTypeProject:
		permissionChecks = append(permissionChecks, permissions_repo.PermissionCheck{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeProject,
			ResourceID:   input.SourceID,
		})
	case schema.VariableReferenceSourceTypeEnvironment:
		permissionChecks = append(permissionChecks, permissions_repo.PermissionCheck{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeEnvironment,
			ResourceID:   input.SourceID,
		})
	case schema.VariableReferenceSourceTypeService:
		permissionChecks = append(permissionChecks, permissions_repo.PermissionCheck{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeService,
			ResourceID:   input.SourceID,
		})
	default:
		return "", errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Invalid source type")
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return "", err
	}

	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return "", err
	}

	// Get team by ID
	namespace, err := self.repo.Team().GetNamespace(ctx, input.TeamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return "", errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return "", err
	}

	// Create a reference source to reuse the resolution logic
	source := schema.VariableReferenceSource{
		Type:                 input.Type,
		SourceType:           input.SourceType,
		SourceID:             input.SourceID,
		SourceKubernetesName: input.Name,
		Key:                  input.Key,
	}

	value, err := self.resolveSourceValue(ctx, client, namespace, source)
	if err != nil {
		return "", err
	}

	return value, nil
}
