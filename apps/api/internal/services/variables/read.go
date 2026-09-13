package variables_service

import (
	"context"
	"sync"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"k8s.io/client-go/kubernetes"
)

func (self *VariablesService) GetVariables(ctx context.Context, userID uuid.UUID, input models.BaseVariablesInput) (*models.VariableResponse, error) {
	if err := self.checkScopePermission(ctx, userID, schema.ActionViewer, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID); err != nil {
		return nil, errdefs.MaskAsNotFound(err, "Resource not found")
	}

	team, _, _, service, secretName, err := self.validateBaseInputs(ctx, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID)
	if err != nil {
		return nil, err
	}

	if input.Type == schema.VariableReferenceSourceTypeService {
		// Sync database secrets; the periodic sync redeploys referencing services if values changed
		if _, err := self.k8s.SyncDatabaseSecretForService(ctx, service); err != nil {
			log.Warnf("Failed to sync database secret for database service %s: %v", service.ID, err)
		}
	}

	client := self.k8s.GetInternalClient()

	secrets, err := self.k8s.GetSecretMap(ctx, secretName, team.Namespace, client)
	if err != nil {
		return nil, err
	}

	return self.buildResponse(ctx, client, input.Type, team.Namespace, service, secrets)
}

func (self *VariablesService) checkScopePermission(ctx context.Context, userID uuid.UUID, action schema.PermittedAction, variableType schema.VariableReferenceSourceType, teamID, projectID, environmentID, serviceID uuid.UUID) error {
	check := permissions_repo.PermissionCheck{Action: action}
	switch variableType {
	case schema.VariableReferenceSourceTypeTeam:
		check.ResourceType, check.ResourceID = schema.ResourceTypeTeam, teamID
	case schema.VariableReferenceSourceTypeProject:
		check.ResourceType, check.ResourceID = schema.ResourceTypeProject, projectID
	case schema.VariableReferenceSourceTypeEnvironment:
		check.ResourceType, check.ResourceID = schema.ResourceTypeEnvironment, environmentID
	case schema.VariableReferenceSourceTypeService:
		check.ResourceType, check.ResourceID = schema.ResourceTypeService, serviceID
	default:
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Invalid variable type")
	}
	return self.repo.Permissions().Check(ctx, userID, []permissions_repo.PermissionCheck{check})
}

// buildResponse lists the variables and, for services, renders their references
func (self *VariablesService) buildResponse(ctx context.Context, client kubernetes.Interface, variableType schema.VariableReferenceSourceType, namespace string, service *ent.Service, secrets map[string][]byte) (*models.VariableResponse, error) {
	var render *RenderResult
	if variableType == schema.VariableReferenceSourceTypeService && service != nil {
		var err error
		render, err = self.renderVariables(ctx, client, service, secrets)
		if err != nil {
			return nil, err
		}
	}

	response := &models.VariableResponse{
		Variables: make([]*models.VariableResponseItem, 0, len(secrets)),
	}
	for name, value := range secrets {
		item := &models.VariableResponseItem{
			Type:       variableType,
			Name:       name,
			Value:      string(value),
			References: []models.VariableReferenceInfo{},
		}
		if render != nil {
			if rendered, ok := render.Variables[name]; ok {
				item.ResolvedValue = new(rendered.Rendered)
				item.References = rendered.References
			}
		}
		response.Variables = append(response.Variables, item)
	}
	response.Variables = append(response.Variables, self.providedVariables(ctx, variableType, namespace, service)...)
	models.SortVariableResponse(response.Variables)

	return response, nil
}

// providedVariables are the endpoint keys Unbind computes for a service. They are
// listed with their values so a connection string can be copied from the same place
// as everything else, but they are not stored and so cannot be written to.
func (self *VariablesService) providedVariables(ctx context.Context, variableType schema.VariableReferenceSourceType, namespace string, service *ent.Service) []*models.VariableResponseItem {
	if variableType != schema.VariableReferenceSourceTypeService || service == nil {
		return nil
	}

	client := self.k8s.GetInternalClient()
	rc, err := self.newRenderContext(ctx, client, service, nil)
	if err != nil {
		log.Warnf("Failed to prepare endpoint variables for service %s: %v", service.ID, err)
		return nil
	}
	rc.services[service.ID] = service

	address := sync.OnceValue(func() string { return clusterAddress(ctx, self.k8s) })
	keys := privateEndpointKeys(service, namespace)
	keys = append(keys, publicEndpointKeys(service, address)...)

	items := make([]*models.VariableResponseItem, 0, len(keys))
	for _, key := range keys {
		value, ok := rc.endpointValue(service, key)
		if !ok {
			continue
		}
		items = append(items, &models.VariableResponseItem{
			Type:       variableType,
			Name:       key,
			Value:      value,
			Provided:   true,
			References: []models.VariableReferenceInfo{},
		})
	}
	return items
}
