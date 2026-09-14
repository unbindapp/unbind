package variables_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/vartemplate"
	"github.com/unbindapp/unbind-api/pkg/databases"
)

// MigrateEndpointKeys rewrites references that use an outdated endpoint key into the
// name that replaced it: the pre-rename names (UNBIND_INTERNAL_URL and friends), the
// keys Unbind used to store on a database, and the port-suffixed keys that now name a
// protocol. Old keys still resolve, so a failure here is not fatal.
func (self *VariablesService) MigrateEndpointKeys(ctx context.Context) error {
	teams, err := self.repo.Team().GetAll(ctx, nil)
	if err != nil {
		return err
	}
	type teamService struct {
		service   *ent.Service
		namespace string
	}
	var services []teamService
	for _, team := range teams {
		teamServices, err := self.repo.Service().GetByScope(ctx, schema.VariableReferenceSourceTypeTeam, team.ID)
		if err != nil {
			log.Warnf("Failed to list services of team %s while renaming endpoint keys: %v", team.ID, err)
			continue
		}
		for _, service := range teamServices {
			services = append(services, teamService{service: service, namespace: team.Namespace})
		}
	}

	client := self.k8s.GetInternalClient()
	sources := make(map[uuid.UUID]*ent.Service, len(services))
	for _, entry := range services {
		sources[entry.service.ID] = entry.service
	}

	migrated := 0
	for _, entry := range services {
		service := entry.service
		values, err := self.k8s.GetSecretMap(ctx, service.KubernetesSecret, entry.namespace, client)
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
				if replacement := LegacyDatabaseKey(source, token.Key); replacement != "" {
					return replacement, true
				}
				replacement := relabelledEndpointKey(source, token.Key)
				return replacement, replacement != ""
			})
			if changed || databaseChanged {
				updates[name] = []byte(renamed)
			}
		}
		if len(updates) == 0 {
			continue
		}

		if _, err := self.k8s.UpsertSecretValues(ctx, service.KubernetesSecret, entry.namespace, updates, client); err != nil {
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

// relabelledEndpointKey turns a key that names a database endpoint by container port
// into the one that names it by protocol, empty when the key already reads right. The
// bare key carries no tiebreaker, so a key that has one is left as it is.
func relabelledEndpointKey(source *ent.Service, key string) string {
	ref, ok := vartemplate.ParseEndpointKey(key)
	if !ok || ref.Legacy || ref.Port == 0 {
		return ""
	}
	dbType := databaseType(source)
	if dbType == "" {
		return ""
	}
	switch ref.Port {
	case databases.DefaultHTTPPort(dbType):
		return vartemplate.EndpointKey(ref.Base, databases.LabelHTTP, ref.Tiebreak)
	case databases.DefaultPort(dbType):
		if ref.Tiebreak > 1 {
			return ""
		}
		return ref.Base
	}
	return ""
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

	// Only the key names matter here, never the address they resolve to
	endpoints := privateEndpoints(source, changeSentinel)
	if ref.Base == vartemplate.KeyURLPublic {
		endpoints = publicEndpoints(source, sentinelAddress)
	}
	if ref.Index > len(endpoints) {
		return "", false
	}
	return endpointKeyAt(ref.Base, endpoints, ref.Index-1), true
}
