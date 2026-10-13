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
	spec.SessionAffinity = config.SessionAffinity
	spec.Stopped = config.Stopped
	spec.CronSchedule = valueOrEmpty(config.CronSchedule)
	spec.CronTimeZone = valueOrEmpty(config.CronTimezone)
	spec.Replicas = new(config.Replicas)
	spec.Volumes = schema.AsV1Volumes(config.Volumes)
	spec.Resources = schema.ResolveResources(config.Resources)
	spec.HealthCheck = config.HealthCheck.AsV1HealthCheck()
	spec.VariableMounts = schema.AsV1VariableMounts(config.VariableMounts)
}

// ExpectedReplicas is how many replicas the service should be running. A scheduled
// service runs nothing between its runs.
func ExpectedReplicas(config *ent.ServiceConfig) int32 {
	if config.Stopped || valueOrEmpty(config.CronSchedule) != "" {
		return 0
	}
	return config.Replicas
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
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
