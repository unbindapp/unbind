package variables_service

import (
	"bytes"
	"context"
	"maps"
	"slices"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"github.com/unbindapp/unbind-api/internal/vartemplate"
)

// VariableWrite is a validated set of upserts and deletes for one scope, ready to apply
type VariableWrite struct {
	Input models.BaseVariablesJSONInput
	// ChangedKeys are the keys whose stored value is created, modified or removed
	ChangedKeys []string
	// NeedsRedeploy is true when a rendered value changes, which needs a new deployment
	// instead of a pod restart
	NeedsRedeploy bool

	team       *ent.Team
	service    *ent.Service
	secretName string
	existing   map[string][]byte
	upserts    map[string][]byte
	deletes    []string
	overwrite  bool
}

func (self *VariableWrite) IsService() bool {
	return self.service != nil
}

func (self *VariableWrite) HasChanges() bool {
	return len(self.ChangedKeys) > 0
}

func (self *VariableWrite) ServiceID() uuid.UUID {
	if self.service == nil {
		return uuid.Nil
	}
	return self.service.ID
}

// SourceID is the ID other services reference this scope by
func (self *VariableWrite) SourceID() uuid.UUID {
	switch self.Input.Type {
	case schema.VariableReferenceSourceTypeTeam:
		return self.Input.TeamID
	case schema.VariableReferenceSourceTypeProject:
		return self.Input.ProjectID
	case schema.VariableReferenceSourceTypeEnvironment:
		return self.Input.EnvironmentID
	case schema.VariableReferenceSourceTypeService:
		return self.Input.ServiceID
	}
	return uuid.Nil
}

func (self *VariableWrite) final() map[string][]byte {
	return finalValues(self.existing, self.upserts, self.deletes, self.overwrite)
}

// PrepareVariableWrite validates a write without touching anything. Apply it with
// ApplyVariableWrite and restart pods with RestartForWrite.
func (self *VariablesService) PrepareVariableWrite(
	ctx context.Context,
	userID uuid.UUID,
	input models.BaseVariablesJSONInput,
	behavior models.VariableUpdateBehavior,
	upserts map[string][]byte,
	deletes []string,
) (*VariableWrite, error) {
	if err := self.checkScopePermission(ctx, userID, schema.ActionEditor, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID); err != nil {
		return nil, err
	}

	team, _, _, service, secretName, err := self.validateBaseInputs(ctx, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID)
	if err != nil {
		return nil, err
	}

	existing, err := self.k8s.GetSecretMap(ctx, secretName, team.Namespace, self.k8s.GetInternalClient())
	if err != nil {
		return nil, err
	}

	if upserts == nil {
		upserts = map[string][]byte{}
	}
	overwrite := behavior == models.VariableUpdateBehaviorOverwrite
	if input.Type == schema.VariableReferenceSourceTypeService {
		if len(upserts) > 0 {
			if err := self.validateReferences(ctx, userID, service, upserts); err != nil {
				return nil, err
			}
		}
		protected := service.Edges.ServiceConfig.ProtectedVariables
		if overwrite {
			for _, name := range protected {
				if _, ok := upserts[name]; !ok {
					upserts[name] = existing[name]
				}
			}
		}
		deletes = slices.DeleteFunc(slices.Clone(deletes), func(name string) bool {
			return slices.Contains(protected, name)
		})
	}

	write := &VariableWrite{
		Input:      input,
		team:       team,
		service:    service,
		secretName: secretName,
		existing:   existing,
		upserts:    upserts,
		deletes:    deletes,
		overwrite:  overwrite,
	}
	final := write.final()
	write.ChangedKeys = changedKeys(existing, final)
	write.NeedsRedeploy = write.IsService() && renderedValuesChange(existing, final, write.ChangedKeys)
	return write, nil
}

// ApplyVariableWrite persists a prepared write and returns the resulting variables
func (self *VariablesService) ApplyVariableWrite(ctx context.Context, write *VariableWrite) (*models.VariableResponse, error) {
	client := self.k8s.GetInternalClient()
	final := write.final()

	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		if write.IsService() && write.service.Edges.ServiceConfig != nil && (write.overwrite || len(write.deletes) > 0) {
			if err := self.pruneVariableConfig(ctx, tx, write.service, final); err != nil {
				return err
			}
		}

		var err error
		switch {
		case write.overwrite:
			_, err = self.k8s.OverwriteSecretValues(ctx, write.secretName, write.team.Namespace, final, client)
		case len(write.deletes) > 0:
			_, err = self.k8s.UpdateSecret(ctx, write.secretName, write.team.Namespace, final, client)
		case len(write.upserts) > 0:
			_, err = self.k8s.UpsertSecretValues(ctx, write.secretName, write.team.Namespace, write.upserts, client)
		}
		return err
	}); err != nil {
		return nil, err
	}

	secrets, err := self.k8s.GetSecretMap(ctx, write.secretName, write.team.Namespace, client)
	if err != nil {
		return nil, err
	}

	return self.buildResponse(ctx, client, write.Input.Type, write.service, secrets)
}

// RestartForWrite restarts pods that read changed values straight from the secret.
// Rendered values need a new deployment instead, which the caller handles.
func (self *VariablesService) RestartForWrite(ctx context.Context, write *VariableWrite) error {
	if !write.IsService() || !write.HasChanges() || write.NeedsRedeploy {
		return nil
	}
	label := write.Input.Type.KubernetesLabel()
	if err := self.k8s.RollingRestartPodsByLabel(ctx, write.team.Namespace, label, write.service.ID.String(), self.k8s.GetInternalClient()); err != nil {
		log.Error("Failed to restart pods", "err", err, "label", label, "value", write.service.ID.String())
		return err
	}
	return nil
}

func finalValues(existing, upserts map[string][]byte, deletes []string, overwrite bool) map[string][]byte {
	final := make(map[string][]byte, len(existing)+len(upserts))
	if !overwrite {
		maps.Copy(final, existing)
	}
	maps.Copy(final, upserts)
	for _, name := range deletes {
		delete(final, name)
	}
	return final
}

func changedKeys(existing, final map[string][]byte) []string {
	var changed []string
	for name, value := range final {
		if current, ok := existing[name]; !ok || !bytes.Equal(current, value) {
			changed = append(changed, name)
		}
	}
	for name := range existing {
		if _, kept := final[name]; !kept {
			changed = append(changed, name)
		}
	}
	slices.Sort(changed)
	return changed
}

// renderedValuesChange reports whether a changed key is rendered into the deployment
// instead of read from the secret
func renderedValuesChange(existing, final map[string][]byte, changed []string) bool {
	for _, name := range changed {
		if vartemplate.HasTokens(string(existing[name])) || vartemplate.HasTokens(string(final[name])) {
			return true
		}
	}
	return false
}
