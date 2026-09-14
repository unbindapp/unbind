package variables_service

import (
	"fmt"
	"slices"
	"strconv"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/vartemplate"
)

// Credentials a database's connection strings are built from. Changing one changes
// every string derived from it, even though nothing references the credential itself.
var databaseCredentialKeys = []string{
	"DATABASE_USERNAME",
	"DATABASE_PASSWORD",
	"DATABASE_DEFAULT_DB_NAME",
}

// changeSentinel stands in for the address an endpoint resolves to, which is a
// property of the cluster rather than the config being compared
const changeSentinel = "cluster"

func sentinelAddress() string { return changeSentinel }

func privateBases(serviceType schema.ServiceType) []string {
	if serviceType == schema.ServiceTypeDatabase {
		return []string{vartemplate.KeyHostPrivate, vartemplate.KeyPortPrivate, vartemplate.KeyDatabaseURLPrivate}
	}
	return []string{vartemplate.KeyHostPrivate, vartemplate.KeyPortPrivate, vartemplate.KeyURLPrivate}
}

func publicBases(serviceType schema.ServiceType) []string {
	bases := []string{vartemplate.KeyHostPublic, vartemplate.KeyPortPublic}
	if serviceType == schema.ServiceTypeDatabase {
		return append(bases, vartemplate.KeyDatabaseURLPublic)
	}
	return append(bases, vartemplate.KeyURLPublic)
}

// ChangedEndpointKeys lists the endpoint keys of a service whose rendered value
// differs between two of its configs. Hosts, ports, allocated node ports and the
// public flag all move an address, so all of them are compared.
func ChangedEndpointKeys(service *ent.Service, before, after *ent.ServiceConfig) []string {
	changed := make(map[string]struct{})
	serviceType, dbType := service.Type, databaseType(service)

	collectChangedKeys(changed, privateBases(serviceType),
		privateEndpointsFor(serviceType, dbType, before, changeSentinel),
		privateEndpointsFor(serviceType, dbType, after, changeSentinel),
	)
	collectChangedKeys(changed, publicBases(serviceType),
		publicEndpointsFor(serviceType, dbType, before, sentinelAddress),
		publicEndpointsFor(serviceType, dbType, after, sentinelAddress),
	)

	if len(changed) == 0 {
		return nil
	}
	keys := make([]string, 0, len(changed))
	for key := range changed {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	return keys
}

// collectChangedKeys records every key of every base that names a different
// endpoint before and after, including keys that only exist on one side
func collectChangedKeys(changed map[string]struct{}, bases []string, before, after []serviceEndpoint) {
	for _, base := range bases {
		names := endpointKeys(base, before)
		for _, name := range endpointKeys(base, after) {
			if !slices.Contains(names, name) {
				names = append(names, name)
			}
		}
		for _, name := range names {
			ref, ok := vartemplate.ParseEndpointKey(name)
			if !ok {
				continue
			}
			if endpointFacet(base, before, ref) != endpointFacet(base, after, ref) {
				changed[name] = struct{}{}
			}
		}
	}
}

// endpointFacet is the part of an endpoint a key actually renders, so a key is only
// reported as changed when the value behind it moves. A host does not change because
// a port next to it did.
func endpointFacet(base string, endpoints []serviceEndpoint, ref vartemplate.EndpointRef) string {
	endpoint, ok := selectEndpoint(endpoints, ref)
	if !ok {
		return ""
	}
	switch base {
	case vartemplate.KeyHostPrivate, vartemplate.KeyHostPublic:
		return endpoint.Host
	case vartemplate.KeyPortPrivate, vartemplate.KeyPortPublic:
		return strconv.Itoa(int(endpoint.Port))
	}
	// Every URL is built from the address, and raw L4 renders without a scheme
	return fmt.Sprintf("%s|%d|%t", endpoint.Host, endpoint.Port, endpoint.L4)
}

// DerivedEndpointKeys lists the endpoint keys whose value changes because one of
// the stored keys they are built from changed. A database's connection strings are
// computed from its credentials, so nothing references the credential directly.
func DerivedEndpointKeys(service *ent.Service, changedKeys []string) []string {
	if service == nil || service.Type != schema.ServiceTypeDatabase {
		return nil
	}
	if !slices.ContainsFunc(changedKeys, func(key string) bool {
		return slices.Contains(databaseCredentialKeys, key)
	}) {
		return nil
	}

	var keys []string
	keys = append(keys, endpointKeys(vartemplate.KeyDatabaseURLPrivate, privateEndpoints(service, changeSentinel))...)
	keys = append(keys, endpointKeys(vartemplate.KeyDatabaseURLPublic, publicEndpoints(service, sentinelAddress))...)
	return keys
}
