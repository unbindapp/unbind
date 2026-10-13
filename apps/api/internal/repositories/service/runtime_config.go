package service_repo

import (
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
)

const CloudflareClientIPHeader = "CF-Connecting-IP"

var cloudflareChecker = utils.NewDNSChecker()

// ClientIPHeader is the header the service's domains take the visitor's address from:
// the one chosen for the service, or Cloudflare's while a domain is proxied through it.
// Resolved on every rollout, so a domain moving on or off Cloudflare is picked up then.
func ClientIPHeader(config *ent.ServiceConfig) string {
	return clientIPHeader(config, func(host string) bool {
		proxied, _ := cloudflareChecker.IsUsingCloudflareProxy(host)
		return proxied
	})
}

func clientIPHeader(config *ent.ServiceConfig, behindCloudflare func(host string) bool) string {
	if config.ClientIPHeader != nil && *config.ClientIPHeader != "" {
		return *config.ClientIPHeader
	}
	if !config.IsPublic {
		return ""
	}
	for _, host := range config.Hosts {
		if utils.IsWildcardHost(host.Host) {
			continue
		}
		if behindCloudflare(host.Host) {
			return CloudflareClientIPHeader
		}
	}
	return ""
}

// ApplyRuntimeConfig sets what the service runs with from its saved config. Build
// inputs like the branch and run command are left alone
func ApplyRuntimeConfig(spec *v1.ServiceConfigSpec, config *ent.ServiceConfig) {
	spec.Hosts = RoutableHosts(config.Hosts)
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

// RoutableHosts leaves out hosts without a target port, except redirects, which never reach the service
func RoutableHosts(hosts []schema.HostSpec) []v1.HostSpec {
	var routable []v1.HostSpec
	for _, host := range schema.AsV1HostSpecs(hosts) {
		if host.Port == nil && host.Redirect == nil {
			continue
		}
		routable = append(routable, host)
	}
	return routable
}
