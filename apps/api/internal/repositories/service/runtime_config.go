package service_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
)

// ApplyRuntimeConfig sets what the service runs with from its saved config. Build
// inputs like the branch and run command are left alone
func ApplyRuntimeConfig(spec *v1.ServiceConfigSpec, config *ent.ServiceConfig) {
	spec.Hosts = routableHosts(config.Hosts)
	spec.Ports = schema.AsV1PortSpecs(config.Ports)
	spec.Public = config.IsPublic
	spec.MaxRequestBodySizeMB = config.MaxRequestBodySizeMB
	spec.Replicas = new(config.Replicas)
	spec.Volumes = schema.AsV1Volumes(config.Volumes)
	spec.Resources = schema.ResolveResources(config.Resources)
}

// A host without a target port has nothing to route to
func routableHosts(hosts []schema.HostSpec) []v1.HostSpec {
	var routable []v1.HostSpec
	for _, host := range schema.AsV1HostSpecs(hosts) {
		if host.Port != nil {
			routable = append(routable, host)
		}
	}
	return routable
}
