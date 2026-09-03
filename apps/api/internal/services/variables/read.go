package variables_service

import (
	"context"

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

	return self.buildResponse(ctx, client, input.Type, service, secrets)
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
func (self *VariablesService) buildResponse(ctx context.Context, client kubernetes.Interface, variableType schema.VariableReferenceSourceType, service *ent.Service, secrets map[string][]byte) (*models.VariableResponse, error) {
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
	models.SortVariableResponse(response.Variables)

	return response, nil
}
