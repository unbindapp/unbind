package variables_service

import (
	"bytes"
	"context"
	"fmt"
	"maps"
	"slices"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
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
	// Endpoint keys are computed from the service, so a stored value of the same name
	// would be shadowed and never read. A value stored under one of these names before
	// they were reserved keeps working, or the raw editor could never save again.
	for name := range upserts {
		if _, stored := existing[name]; !stored && vartemplate.IsEndpointKey(name) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput,
				fmt.Sprintf("%s is provided by Unbind and cannot be set", name))
		}
	}

	overwrite := behavior == models.VariableUpdateBehaviorOverwrite
	if input.Type == schema.VariableReferenceSourceTypeService {
		if len(upserts) > 0 {
			if err := self.validateReferences(ctx, userID, service, upserts); err != nil {
				return nil, err
			}
		}
		protected := service.Edges.ServiceConfig.ProtectedVariables
		if name, violated := protectedViolation(existing, upserts, deletes, protected); violated {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput,
				fmt.Sprintf("%s is managed by Unbind and cannot be changed or deleted", name))
		}
		if overwrite {
			for _, name := range protected {
				if _, ok := upserts[name]; !ok {
					upserts[name] = existing[name]
				}
			}
		}
		if err := applyDerivations(existing, upserts, deletes, overwrite, service.Edges.ServiceConfig.VariableMetadata); err != nil {
			return nil, err
		}
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

	response, err := self.buildResponse(ctx, client, write.Input.Type, write.team.Namespace, write.service, secrets)
	if err != nil {
		return nil, err
	}
	if !permissions_repo.HasCapability(ctx, schema.CapabilityReadVariableValues) {
		response.Redact()
	}
	return response, nil
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

// protectedViolation names the first protected key a write would change or delete.
// Re-sending the stored value is allowed, since bulk writes carry every variable.
func protectedViolation(existing, upserts map[string][]byte, deletes, protected []string) (string, bool) {
	for _, name := range slices.Sorted(slices.Values(protected)) {
		if slices.Contains(deletes, name) {
			return name, true
		}
		value, upserted := upserts[name]
		if !upserted {
			continue
		}
		if current, stored := existing[name]; !stored || !bytes.Equal(current, value) {
			return name, true
		}
	}
	return "", false
}

// applyDerivations rewrites every derived variable whose sources change, and keeps a
// source from being removed. A derived variable can itself be a source, so this repeats
// until nothing new changes. Reissued variables are protected, so this runs after that check.
func applyDerivations(existing, upserts map[string][]byte, deletes []string, overwrite bool, metadata map[string]schema.VariableMetadata) error {
	derivedNames := slices.DeleteFunc(slices.Sorted(maps.Keys(metadata)), func(name string) bool {
		_, stored := existing[name]
		return metadata[name].DerivedFrom == nil || !stored
	})

	for _, name := range derivedNames {
		for _, source := range metadata[name].DerivedFrom.Sources {
			if slices.Contains(deletes, source) {
				return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput,
					fmt.Sprintf("%s cannot be deleted, %s is derived from it", source, name))
			}
			current, stored := existing[source]
			if _, upserted := upserts[source]; overwrite && stored && !upserted {
				upserts[source] = current
			}
		}
	}

	applied := make(map[string]struct{})
	for range derivedNames {
		progressed := false
		for _, name := range derivedNames {
			changes := make(map[string]schema.VariableChange)
			for _, source := range metadata[name].DerivedFrom.Sources {
				value, upserted := upserts[source]
				if _, done := applied[name+"\x00"+source]; done || !upserted || bytes.Equal(existing[source], value) {
					continue
				}
				changes[source] = schema.VariableChange{Old: string(existing[source]), New: string(value)}
				applied[name+"\x00"+source] = struct{}{}
			}
			if len(changes) == 0 {
				continue
			}

			current := existing[name]
			if pending, upserted := upserts[name]; upserted {
				current = pending
			}
			derived, err := metadata[name].DerivedFrom.Derive(name, string(current), changes)
			if err != nil {
				return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
			}
			upserts[name] = []byte(derived)
			progressed = true
		}
		if !progressed {
			break
		}
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
