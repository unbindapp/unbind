package variables_service

import (
	"slices"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/models"
	"github.com/unbindapp/unbind-api/internal/vartemplate"
)

// providedKey is a variable Unbind computes for a service instead of storing. Type
// is the group the reference picker shows it under.
type providedKey struct {
	Key  string
	Type schema.VariableReferenceType
}

// providedKeys lists everything Unbind provides for a service, in picker order. The
// Provided by Unbind section, the reference picker and the renderer all read this
// list, so a key added here reaches all three, for other services and the service
// itself alike. Values come from providedValue.
func (rc *renderContext) providedKeys(source *ent.Service) []providedKey {
	var keys []providedKey
	for _, key := range privateEndpointKeys(source, rc.namespace) {
		keys = append(keys, providedKey{Key: key, Type: schema.VariableReferenceTypePrivateEndpoint})
	}
	for _, key := range publicEndpointKeys(source, rc.clusterAddress) {
		keys = append(keys, providedKey{Key: key, Type: schema.VariableReferenceTypePublicEndpoint})
	}
	return keys
}

// providedValue computes one provided key of a service. Endpoint keys are parsed
// rather than looked up, so a port alias or a legacy name reaches the same endpoint.
func (rc *renderContext) providedValue(source *ent.Service, key string) (string, bool) {
	return rc.endpointValue(source, key)
}

// providedReferences groups a service's provided keys into picker entries, one per type
func (rc *renderContext) providedReferences(source *ent.Service) []models.AvailableVariableReference {
	var references []models.AvailableVariableReference
	for _, provided := range rc.providedKeys(source) {
		index := slices.IndexFunc(references, func(reference models.AvailableVariableReference) bool {
			return reference.Type == provided.Type
		})
		if index < 0 {
			references = append(references, models.AvailableVariableReference{
				Type:                 provided.Type,
				SourceName:           source.Name,
				SourceIcon:           serviceIcon(source),
				SourceKubernetesName: source.KubernetesName,
				SourceType:           schema.VariableReferenceSourceTypeService,
				SourceID:             source.ID,
			})
			index = len(references) - 1
		}
		references[index].Keys = append(references[index].Keys, provided.Key)
	}
	return references
}

// isProvidedKey reports whether Unbind computes a key for a service instead of
// storing it. Such a name can be referenced but never written.
func isProvidedKey(key string) bool {
	return vartemplate.IsEndpointKey(key)
}

// privateEndpointKeys are the keys for reaching a service from inside the cluster.
// The host never varies by port, so it is offered once.
func privateEndpointKeys(service *ent.Service, namespace string) []string {
	endpoints := privateEndpoints(service, namespace)
	if len(endpoints) == 0 {
		return nil
	}
	keys := []string{vartemplate.KeyHostPrivate}
	urlBase := vartemplate.KeyURLPrivate
	if isDatabase(service) {
		urlBase = vartemplate.KeyDatabaseURLPrivate
	}
	keys = append(keys, endpointKeys(urlBase, endpoints)...)
	keys = append(keys, endpointKeys(vartemplate.KeyPortPrivate, endpoints)...)
	return keys
}

// publicEndpointKeys are the keys for reaching a service from the internet. A
// private service has none.
func publicEndpointKeys(service *ent.Service, clusterAddress func() string) []string {
	endpoints := publicEndpoints(service, clusterAddress)
	if len(endpoints) == 0 {
		return nil
	}
	urlBase := vartemplate.KeyURLPublic
	if isDatabase(service) {
		urlBase = vartemplate.KeyDatabaseURLPublic
	}
	keys := endpointKeys(urlBase, endpoints)
	keys = append(keys, endpointKeys(vartemplate.KeyHostPublic, endpoints)...)
	return append(keys, endpointKeys(vartemplate.KeyPortPublic, endpoints)...)
}
