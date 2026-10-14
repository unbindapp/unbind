package service_repo

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
)

func TestApplyRuntimeConfig(t *testing.T) {
	spec := v1.ServiceConfigSpec{
		GitBranch:  "refs/heads/main",
		RunCommand: new("./start"),
		Hosts:      []v1.HostSpec{{Host: "old.example.com", Path: "/", Port: new(int32(80))}},
		Ports:      []v1.PortSpec{{Port: 80}},
		Public:     true,
		Replicas:   new(int32(1)),
	}
	config := &ent.ServiceConfig{
		Hosts: []schema.HostSpec{
			{Host: "new.example.com", TargetPort: new(int32(3000))},
			{Host: "no-port.example.com"},
			{Host: "www.example.com", Redirect: &schema.HostRedirect{To: "https://example.com", StatusCode: 301}},
			{Host: "install.example.com", Proxy: &schema.HostProxy{To: "https://example.net/install.sh"}},
		},
		Ports:                []schema.PortSpec{{Port: 3000}},
		IsPublic:             false,
		Replicas:             3,
		MaxRequestBodySizeMB: new(int32(500)),
		SessionAffinity:      true,
		Stopped:              true,
		CronSchedule:         new("*/10 * * * *"),
		CronTimezone:         new("Europe/Berlin"),
	}

	ApplyRuntimeConfig(&spec, config)

	assert.Equal(t, []v1.HostSpec{
		{Host: "new.example.com", Port: new(int32(3000))},
		{Host: "www.example.com", Redirect: &v1.HostRedirectSpec{To: "https://example.com", StatusCode: 301}},
		{Host: "install.example.com", Proxy: &v1.HostProxySpec{To: "https://example.net/install.sh"}},
	}, spec.Hosts, "a redirect or proxy is routed without a target port")
	assert.Equal(t, schema.AsV1PortSpecs(config.Ports), spec.Ports)
	assert.False(t, spec.Public)
	assert.Equal(t, int32(3), *spec.Replicas)
	assert.Equal(t, int32(500), *spec.MaxRequestBodySizeMB)
	assert.True(t, spec.SessionAffinity)
	assert.True(t, spec.Stopped)
	assert.Equal(t, "*/10 * * * *", spec.CronSchedule)
	assert.Equal(t, "Europe/Berlin", spec.CronTimeZone)
	assert.Equal(t, "refs/heads/main", spec.GitBranch)
	assert.Equal(t, "./start", *spec.RunCommand)

	ApplyRuntimeConfig(&spec, &ent.ServiceConfig{Replicas: 1})
	assert.Empty(t, spec.Hosts)
	assert.Empty(t, spec.Ports)
	assert.Nil(t, spec.MaxRequestBodySizeMB)
	assert.False(t, spec.SessionAffinity)
	assert.False(t, spec.Stopped)
	assert.Empty(t, spec.CronSchedule, "a cleared schedule runs the service continuously again")
	assert.Empty(t, spec.CronTimeZone)
}

func TestApplyRuntimeConfigHealthCheckAndVariableMounts(t *testing.T) {
	spec := v1.ServiceConfigSpec{
		HealthCheck:    &v1.HealthCheckSpec{Type: "http", Path: "/sping"},
		VariableMounts: []v1.VariableMountSpec{{Name: "OLD_CERT", Path: "/etc/old.pem"}},
	}

	ApplyRuntimeConfig(&spec, &ent.ServiceConfig{
		Replicas:       1,
		HealthCheck:    &schema.HealthCheck{Type: new(schema.HealthCheckTypeExec), Command: "true"},
		VariableMounts: []*schema.VariableMount{{Name: "CERT", Path: "/etc/cert.pem"}},
	})
	assert.Equal(t, "exec", spec.HealthCheck.Type)
	assert.Equal(t, "true", spec.HealthCheck.Command)
	assert.Equal(t, []v1.VariableMountSpec{{Name: "CERT", Path: "/etc/cert.pem"}}, spec.VariableMounts)

	ApplyRuntimeConfig(&spec, &ent.ServiceConfig{
		Replicas:    1,
		HealthCheck: &schema.HealthCheck{Type: new(schema.HealthCheckTypeNone)},
	})
	assert.Nil(t, spec.HealthCheck, "a check of type none removes the probes")
	assert.Nil(t, spec.VariableMounts)

	ApplyRuntimeConfig(&spec, &ent.ServiceConfig{Replicas: 1})
	assert.Nil(t, spec.HealthCheck)
}

func TestExpectedReplicas(t *testing.T) {
	assert.Equal(t, int32(3), ExpectedReplicas(&ent.ServiceConfig{Replicas: 3}))
	assert.Equal(t, int32(0), ExpectedReplicas(&ent.ServiceConfig{Replicas: 3, Stopped: true}), "a stopped service expects no replicas")
	assert.Equal(t, int32(0), ExpectedReplicas(&ent.ServiceConfig{Replicas: 3, CronSchedule: new("0 * * * *")}), "a scheduled service runs nothing between runs")
}

func TestClientIPHeader(t *testing.T) {
	proxied := map[string]bool{"app.example.com": true}
	behindCloudflare := func(host string) bool { return proxied[host] }
	hosts := func(names ...string) []schema.HostSpec {
		specs := make([]schema.HostSpec, len(names))
		for i, name := range names {
			specs[i] = schema.HostSpec{Host: name}
		}
		return specs
	}

	t.Run("a chosen header wins", func(t *testing.T) {
		config := &ent.ServiceConfig{IsPublic: true, ClientIPHeader: new("X-Real-IP"), Hosts: hosts("app.example.com")}
		assert.Equal(t, "X-Real-IP", clientIPHeader(config, behindCloudflare))
	})

	t.Run("a domain behind cloudflare picks its header", func(t *testing.T) {
		config := &ent.ServiceConfig{IsPublic: true, Hosts: hosts("other.example.com", "app.example.com")}
		assert.Equal(t, CloudflareClientIPHeader, clientIPHeader(config, behindCloudflare))
	})

	t.Run("no proxied domain means no header", func(t *testing.T) {
		config := &ent.ServiceConfig{IsPublic: true, Hosts: hosts("other.example.com")}
		assert.Equal(t, "", clientIPHeader(config, behindCloudflare))
	})

	t.Run("wildcards are never looked up", func(t *testing.T) {
		looked := []string{}
		config := &ent.ServiceConfig{IsPublic: true, Hosts: hosts("*.example.com")}
		clientIPHeader(config, func(host string) bool { looked = append(looked, host); return false })
		assert.Empty(t, looked)
	})

	t.Run("a private service has no visitors", func(t *testing.T) {
		config := &ent.ServiceConfig{Hosts: hosts("app.example.com")}
		assert.Equal(t, "", clientIPHeader(config, behindCloudflare))
	})
}
