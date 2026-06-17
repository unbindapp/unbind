package variables_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *VariablesService) GetVariables(ctx context.Context, userID uuid.UUID, bearerToken string, input models.BaseVariablesInput) (*models.VariableResponse, error) {
	var permissionChecks []permissions_repo.PermissionCheck

	switch input.Type {
	case schema.VariableReferenceSourceTypeTeam:
		permissionChecks = append(permissionChecks, permissions_repo.PermissionCheck{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   input.TeamID,
		})
	case schema.VariableReferenceSourceTypeProject:
		permissionChecks = append(permissionChecks, permissions_repo.PermissionCheck{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeProject,
			ResourceID:   input.ProjectID,
		})
	case schema.VariableReferenceSourceTypeEnvironment:
		permissionChecks = append(permissionChecks, permissions_repo.PermissionCheck{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeEnvironment,
			ResourceID:   input.EnvironmentID,
		})
	case schema.VariableReferenceSourceTypeService:
		permissionChecks = append(permissionChecks, permissions_repo.PermissionCheck{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeService,
			ResourceID:   input.ServiceID,
		})
	default:
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Invalid variable type")
	}

	if err := self.repo.Permissions().Check(
		ctx,
		userID,
		permissionChecks,
	); err != nil {
		return nil, err
	}

	// Verify input
	team, _, _, service, secretName, err := self.validateBaseInputs(ctx, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID)
	if err != nil {
		return nil, err
	}

	if input.Type == schema.VariableReferenceSourceTypeService {
		// Sync database secrets
		err = self.k8s.SyncDatabaseSecretForService(ctx, service)
		if err != nil {
			log.Warnf("Failed to sync database secret for database service %s: %v", service.ID, err)
		}
	}

	// Create kubernetes client
	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}

	// Get secrets
	secrets, err := self.k8s.GetSecretMap(ctx, secretName, team.Namespace, client)
	if err != nil {
		return nil, err
	}

	variableResponse := &models.VariableResponse{
		Variables:          make([]*models.VariableResponseItem, len(secrets)),
		VariableReferences: []*models.VariableReferenceResponse{},
	}
	i := 0
	for k, v := range secrets {
		variableResponse.Variables[i] = &models.VariableResponseItem{
			Type:  input.Type,
			Name:  k,
			Value: string(v),
		}
		i++
	}
	models.SortVariableResponse(variableResponse.Variables)

	// Add references if this is for a service
	if input.Type == schema.VariableReferenceSourceTypeService {
		references, err := self.repo.Variables().GetReferencesForService(ctx, input.ServiceID)
		if err != nil {
			return nil, err
		}

		// Check and clear errros for any references
		for _, ref := range references {
			if ref.Error != nil {
				// Try to resolve
				_, err := self.resolveReference(ctx, client, team.Namespace, ref)
				if err == nil {
					_, err = self.repo.Variables().ClearError(ctx, ref.ID)
					if err != nil {
						log.Errorf("Failed to clear error for variable reference %s: %v", ref.ID, err)
					} else {
						ref.Error = nil
					}
				}
			}
		}

		variableResponse.VariableReferences = models.TransformVariableReferenceResponseEntities(references)
	}

	return variableResponse, nil
}
