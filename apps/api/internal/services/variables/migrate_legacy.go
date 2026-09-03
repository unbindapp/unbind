package variables_service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/vartemplate"
)

// MigrateLegacyReferences writes rows of the old variable_references table into the
// target service's secret as ${{...}} templates. Rows are kept and marked so the
// step is idempotent and an older release can still read them.
func (self *VariablesService) MigrateLegacyReferences(ctx context.Context) error {
	references, err := self.repo.Variables().GetUnmigratedReferences(ctx)
	if err != nil {
		return err
	}
	if len(references) == 0 {
		return nil
	}
	log.Infof("Migrating %d legacy variable references into service secrets", len(references))

	byTarget := make(map[uuid.UUID][]*ent.VariableReference)
	for _, reference := range references {
		byTarget[reference.TargetServiceID] = append(byTarget[reference.TargetServiceID], reference)
	}

	client := self.k8s.GetInternalClient()
	for targetID, targetReferences := range byTarget {
		target, err := self.repo.Service().GetByID(ctx, targetID)
		if err != nil {
			if !ent.IsNotFound(err) {
				log.Errorf("Failed to load service %s for legacy variable references: %v", targetID, err)
				continue
			}
			// Orphaned rows have nothing to migrate into
			self.markMigrated(ctx, targetReferences)
			continue
		}

		values := make(map[string][]byte, len(targetReferences))
		for _, reference := range targetReferences {
			values[reference.TargetName] = []byte(self.legacyTemplate(ctx, reference))
		}
		if _, err := self.k8s.UpsertSecretValues(ctx, target.KubernetesSecret, serviceNamespace(target), values, client); err != nil {
			log.Errorf("Failed to write legacy variable references for service %s: %v", targetID, err)
			continue
		}
		self.markMigrated(ctx, targetReferences)
	}

	return nil
}

func (self *VariablesService) markMigrated(ctx context.Context, references []*ent.VariableReference) {
	for _, reference := range references {
		if err := self.repo.Variables().MarkReferenceMigrated(ctx, reference.ID); err != nil {
			log.Errorf("Failed to mark variable reference %s as migrated: %v", reference.ID, err)
		}
	}
}

// legacyTemplate rewrites the old ${kube-name.KEY} tokens into ${{source.KEY}} tokens
func (self *VariablesService) legacyTemplate(ctx context.Context, reference *ent.VariableReference) string {
	value := reference.ValueTemplate
	for _, source := range reference.Sources {
		old := fmt.Sprintf("${%s.%s}", source.SourceKubernetesName, source.Key)
		value = strings.ReplaceAll(value, old, self.legacyToken(ctx, source))
	}
	return value
}

func (self *VariablesService) legacyToken(ctx context.Context, source schema.VariableReferenceSource) string {
	if source.SourceType != schema.VariableReferenceSourceTypeService {
		return vartemplate.ScopeToken(source.SourceType, source.Key)
	}

	switch source.Type {
	case schema.VariableReferenceTypeInternalEndpoint:
		databaseType, err := self.repo.Service().GetDatabaseType(ctx, source.SourceID)
		if err != nil {
			log.Warnf("Failed to load referenced service %s: %v", source.SourceID, err)
		}
		if databaseType != "" {
			return vartemplate.ServiceToken(source.SourceID, vartemplate.KeyInternalHost)
		}
		return vartemplate.ServiceToken(source.SourceID, vartemplate.KeyInternalURL)
	case schema.VariableReferenceTypeExternalEndpoint:
		return vartemplate.ServiceToken(source.SourceID, vartemplate.EndpointKey(vartemplate.KeyExternalURL, self.legacyHostIndex(ctx, source)))
	default:
		return vartemplate.ServiceToken(source.SourceID, source.Key)
	}
}

// Old external references named the host; the new ones name its position in the service config
func (self *VariablesService) legacyHostIndex(ctx context.Context, source schema.VariableReferenceSource) int {
	services, err := self.repo.Service().GetByIDs(ctx, []uuid.UUID{source.SourceID})
	if err != nil || len(services) == 0 {
		return 1
	}
	for i, host := range externalHosts(services[0]) {
		if host.Host == source.Key {
			return i + 1
		}
	}
	return 1
}
