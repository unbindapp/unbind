package variables_service

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// Create secrets in bulk
func (self *VariablesService) UpdateVariables(
	ctx context.Context,
	userID uuid.UUID,
	bearerToken string,
	referenceInput []*models.VariableReferenceInputItem,
	input models.BaseVariablesJSONInput,
	behavior models.VariableUpdateBehavior,
	newVariables map[string][]byte,
) (*models.VariableResponse, error) {
	var permissionChecks []permissions_repo.PermissionCheck

	switch input.Type {
	case schema.VariableReferenceSourceTypeTeam:
		permissionChecks = append(permissionChecks, permissions_repo.PermissionCheck{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   input.TeamID,
		})
	case schema.VariableReferenceSourceTypeProject:
		permissionChecks = append(permissionChecks, permissions_repo.PermissionCheck{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeProject,
			ResourceID:   input.ProjectID,
		})
	case schema.VariableReferenceSourceTypeEnvironment:
		permissionChecks = append(permissionChecks, permissions_repo.PermissionCheck{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeEnvironment,
			ResourceID:   input.EnvironmentID,
		})
	case schema.VariableReferenceSourceTypeService:
		permissionChecks = append(permissionChecks, permissions_repo.PermissionCheck{
			Action:       schema.ActionEditor,
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

	// Validate reference input
	if input.Type == schema.VariableReferenceSourceTypeService && len(referenceInput) > 0 {
		if err := ValidateCreateVariableReferenceInput(input.ServiceID, referenceInput); err != nil {
			return nil, err
		}
	}

	// Create kubernetes client
	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}

	references := []*models.VariableReferenceResponse{}
	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		if input.Type == schema.VariableReferenceSourceTypeService && len(referenceInput) > 0 {
			referenceResp, err := self.repo.Variables().UpdateReferences(ctx, tx, behavior, input.ServiceID, referenceInput)
			if err != nil {
				if ent.IsConstraintError(err) {
					return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Variable reference already exists")
				}
				return err
			}

			references = models.TransformVariableReferenceResponseEntities(referenceResp)
		}

		if behavior == models.VariableUpdateBehaviorOverwrite && input.Type == schema.VariableReferenceSourceTypeService {
			// Get existing secrets
			existingSecrets, err := self.k8s.GetSecretMap(ctx, secretName, team.Namespace, client)
			if err != nil {
				return err
			}

			for _, protectedVariable := range service.Edges.ServiceConfig.ProtectedVariables {
				if _, hasProtectedVariable := newVariables[protectedVariable]; !hasProtectedVariable {
					newVariables[protectedVariable] = existingSecrets[protectedVariable]
				}
			}

			var variableMounts []*schema.VariableMount
			if service != nil && service.Edges.ServiceConfig != nil {
				// Check if variable mounts were removed
				variableMounts = service.Edges.ServiceConfig.VariableMounts
				indexesToDelete := []int{}
				needsUpdate := false
				for i, variableMount := range variableMounts {
					// Check if the variable mount is in the new variables
					if _, ok := newVariables[variableMount.Name]; !ok {
						needsUpdate = true
						indexesToDelete = append(indexesToDelete, i)
					}
				}
				// Remove the variable mounts that were deleted
				for i := len(indexesToDelete) - 1; i >= 0; i-- {
					index := indexesToDelete[i]
					variableMounts = append(variableMounts[:index], variableMounts[index+1:]...)
				}
				if needsUpdate {
					if err := self.repo.Service().UpdateVariableMounts(ctx, tx, service.ID, variableMounts); err != nil {
						return err
					}
				}
			}

			_, err = self.k8s.OverwriteSecretValues(ctx, secretName, team.Namespace, newVariables, client)
			if err != nil {
				return err
			}
		} else if behavior == models.VariableUpdateBehaviorOverwrite {
			_, err = self.k8s.OverwriteSecretValues(ctx, secretName, team.Namespace, newVariables, client)
			if err != nil {
				return err
			}
		} else {
			// make secrets
			_, err = self.k8s.UpsertSecretValues(ctx, secretName, team.Namespace, newVariables, client)
			if err != nil {
				return err
			}
		}

		return nil
	}); err != nil {
		return nil, err
	}

	// Get secrets
	secrets, err := self.k8s.GetSecretMap(ctx, secretName, team.Namespace, client)
	if err != nil {
		return nil, err
	}

	variableResponse := &models.VariableResponse{
		Variables:          make([]*models.VariableResponseItem, len(secrets)),
		VariableReferences: references,
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
		variableResponse.VariableReferences = models.TransformVariableReferenceResponseEntities(references)
	}

	// Perform a restart of pods...
	// ! TODO - handle references
	if input.Type == schema.VariableReferenceSourceTypeService {
		err = self.k8s.RollingRestartPodsByLabel(ctx, team.Namespace, input.Type.KubernetesLabel(), service.ID.String(), client)
		if err != nil {
			log.Error("Failed to restart pods", "err", err, "label", input.Type.KubernetesLabel(), "value", service.ID.String())
			return nil, err
		}
	}

	return variableResponse, nil
}

// Validate for CreateVariableReferenceInput
func ValidateCreateVariableReferenceInput(serviceID uuid.UUID, items []*models.VariableReferenceInputItem) error {
	for _, item := range items {
		if len(item.Sources) == 0 {
			return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "At least one source is required")
		}

		template := item.Value

		// Track which sources have been referenced
		sourcesReferenced := make(map[string]bool)
		for _, source := range item.Sources {
			sourcesReferenced[source.SourceKubernetesName+"."+source.Key] = false
		}

		// Find all occurrences of ${...} in the template that aren't escaped
		// We'll use regexp to find all instances, then check if they're escaped
		re := regexp.MustCompile(`\${([^}]+)}`)
		matches := re.FindAllStringSubmatchIndex(template, -1)

		for _, match := range matches {
			// Check if this is an escaped instance (preceded by \)
			if match[0] > 0 && template[match[0]-1] == '\\' {
				continue // Skip escaped instances
			}

			// Extract the source reference (name.key)
			reference := template[match[2]:match[3]]

			// Mark this source as referenced if it exists in our sources
			if _, exists := sourcesReferenced[reference]; exists {
				sourcesReferenced[reference] = true
			}
		}

		// Check if all sources have been referenced
		var missingReferences []string
		for sourceRef, referenced := range sourcesReferenced {
			if !referenced {
				missingReferences = append(missingReferences, sourceRef)
			}
		}

		if len(missingReferences) > 0 {
			return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("template is missing references to the following sources: %s",
				strings.Join(missingReferences, ", ")))
		}
	}

	return nil
}
