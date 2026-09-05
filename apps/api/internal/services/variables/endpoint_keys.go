package variables_service

import (
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/vartemplate"
)

// ChangedEndpointKeys lists the endpoint keys of a service whose rendered value
// differs between two of its configs
func ChangedEndpointKeys(serviceType schema.ServiceType, before, after *ent.ServiceConfig) []string {
	var keys []string

	beforePorts, afterPorts := configInternalPorts(serviceType, before), configInternalPorts(serviceType, after)
	for i := range max(len(beforePorts), len(afterPorts)) {
		if i < len(beforePorts) && i < len(afterPorts) && beforePorts[i] == afterPorts[i] {
			continue
		}
		keys = append(keys,
			vartemplate.EndpointKey(vartemplate.KeyInternalURL, i+1),
			vartemplate.EndpointKey(vartemplate.KeyInternalPort, i+1),
		)
	}

	beforeHosts, afterHosts := configHosts(before), configHosts(after)
	for i := range max(len(beforeHosts), len(afterHosts)) {
		if i < len(beforeHosts) && i < len(afterHosts) && beforeHosts[i].Host == afterHosts[i].Host {
			continue
		}
		keys = append(keys, vartemplate.EndpointKey(vartemplate.KeyExternalURL, i+1))
	}

	return keys
}
