package variables_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/vartemplate"
)

// MigrateEndpointKeys rewrites references that use a pre-rename endpoint key
// (UNBIND_INTERNAL_URL and friends) into the public/private names. Old keys still
// resolve, so this only has to run once and a failure is not fatal.
func (self *VariablesService) MigrateEndpointKeys(ctx context.Context) error {
	teams, err := self.repo.Team().GetAll(ctx, nil)
	if err != nil {
		return err
	}
	var services []*ent.Service
	for _, team := range teams {
		teamServices, err := self.repo.Service().GetByScope(ctx, schema.VariableReferenceSourceTypeTeam, team.ID)
		if err != nil {
			log.Warnf("Failed to list services of team %s while renaming endpoint keys: %v", team.ID, err)
			continue
		}
		services = append(services, teamServices...)
	}

	client := self.k8s.GetInternalClient()
	sources := make(map[uuid.UUID]*ent.Service, len(services))
	for _, service := range services {
		sources[service.ID] = service
	}

	migrated := 0
	for _, service := range services {
		values, err := self.k8s.GetSecretMap(ctx, service.KubernetesSecret, serviceNamespace(service), client)
		if err != nil {
			log.Warnf("Failed to read variables of service %s while renaming endpoint keys: %v", service.ID, err)
			continue
		}

		updates := make(map[string][]byte)
		for name, raw := range values {
			renamed, changed := vartemplate.RenameLegacyEndpointKeys(string(raw), func(token vartemplate.Token, ref vartemplate.EndpointRef) (string, bool) {
				return self.renamedEndpointKey(sources, token, ref)
			})
			renamed, databaseChanged := vartemplate.RenameKeys(renamed, func(token vartemplate.Token) (string, bool) {
				source, ok := sources[token.SourceID]
				if !ok {
					return "", false
				}
				replacement := LegacyDatabaseKey(source, token.Key)
				return replacement, replacement != ""
			})
			if changed || databaseChanged {
				updates[name] = []byte(renamed)
			}
		}
		if len(updates) == 0 {
			continue
		}

		if _, err := self.k8s.UpsertSecretValues(ctx, service.KubernetesSecret, serviceNamespace(service), updates, client); err != nil {
			log.Errorf("Failed to rename endpoint keys for service %s: %v", service.ID, err)
			continue
		}
		migrated++
	}

	if migrated > 0 {
		log.Infof("Renamed endpoint key references in %d services", migrated)
	}
	return nil
}

// renamedEndpointKey turns a positional legacy key into the key that names the same
// endpoint by port. Unknown sources keep their old key, which still resolves.
func (self *VariablesService) renamedEndpointKey(sources map[uuid.UUID]*ent.Service, token vartemplate.Token, ref vartemplate.EndpointRef) (string, bool) {
	if ref.Index <= 1 {
		return ref.Base, true
	}
	if token.SourceType != schema.VariableReferenceSourceTypeService {
		return "", false
	}
	source, ok := sources[token.SourceID]
	if !ok {
		return "", false
	}

	endpoints := privateEndpoints(source, serviceNamespace(source))
	if ref.Base == vartemplate.KeyURLPublic {
		endpoints = publicEndpoints(source, sentinelAddress)
	}
	if ref.Index > len(endpoints) {
		return "", false
	}
	return endpointKeyAt(ref.Base, endpoints, ref.Index-1), true
}
