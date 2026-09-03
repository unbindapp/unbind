package variables_service

import (
	"context"
	"slices"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"github.com/unbindapp/unbind-api/internal/vartemplate"
)

// DeleteVariablesByKey removes variables. The returned bool is true when a rendered
// value was removed, meaning the service needs a new deployment rather than a pod restart.
func (self *VariablesService) DeleteVariablesByKey(ctx context.Context, userID uuid.UUID, input models.BaseVariablesJSONInput, keys []models.VariableDeleteInput) (*models.VariableResponse, bool, error) {
	if err := self.checkScopePermission(ctx, userID, schema.ActionEditor, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID); err != nil {
		return nil, false, err
	}

	team, _, _, service, secretName, err := self.validateBaseInputs(ctx, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID)
	if err != nil {
		return nil, false, err
	}

	client := self.k8s.GetInternalClient()
	isService := input.Type == schema.VariableReferenceSourceTypeService

	needsRedeploy := false
	secrets := make(map[string][]byte)
	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		secrets, err = self.k8s.GetSecretMap(ctx, secretName, team.Namespace, client)
		if err != nil {
			return err
		}

		var variableMounts []*schema.VariableMount
		var variableMetadata map[string]schema.VariableMetadata
		mountsChanged := false
		metadataChanged := false
		if service != nil && service.Edges.ServiceConfig != nil {
			variableMounts = service.Edges.ServiceConfig.VariableMounts
			variableMetadata = service.Edges.ServiceConfig.VariableMetadata
		}

		for _, key := range keys {
			if isService && slices.Contains(service.Edges.ServiceConfig.ProtectedVariables, key.Name) {
				continue
			}

			if index := slices.IndexFunc(variableMounts, func(mount *schema.VariableMount) bool { return mount.Name == key.Name }); index != -1 {
				mountsChanged = true
				variableMounts = slices.Delete(variableMounts, index, index+1)
			}

			if _, ok := variableMetadata[key.Name]; ok {
				delete(variableMetadata, key.Name)
				metadataChanged = true
			}

			if value, ok := secrets[key.Name]; ok && vartemplate.HasTokens(string(value)) {
				needsRedeploy = true
			}
			delete(secrets, key.Name)
		}

		if mountsChanged {
			if err := self.repo.Service().UpdateVariableMounts(ctx, tx, service.ID, variableMounts); err != nil {
				return err
			}
		}

		if metadataChanged {
			if err := self.repo.Service().UpdateVariableMetadata(ctx, tx, service.ID, variableMetadata); err != nil {
				return err
			}
		}

		_, err = self.k8s.UpdateSecret(ctx, secretName, team.Namespace, secrets, client)
		return err
	}); err != nil {
		return nil, false, err
	}

	response, err := self.buildResponse(ctx, client, input.Type, service, secrets)
	if err != nil {
		return nil, false, err
	}

	if isService && !needsRedeploy {
		if err := self.k8s.RollingRestartPodsByLabel(ctx, team.Namespace, input.Type.KubernetesLabel(), service.ID.String(), client); err != nil {
			log.Error("Failed to restart pods", "err", err, "label", input.Type.KubernetesLabel(), "value", service.ID.String())
			return nil, false, err
		}
	}

	return response, needsRedeploy, nil
}
