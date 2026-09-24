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
		},
		Ports:    []schema.PortSpec{{Port: 3000}},
		IsPublic: false,
		Replicas: 3,
	}

	ApplyRuntimeConfig(&spec, config)

	assert.Equal(t, []v1.HostSpec{{Host: "new.example.com", Port: new(int32(3000))}}, spec.Hosts)
	assert.Equal(t, schema.AsV1PortSpecs(config.Ports), spec.Ports)
	assert.False(t, spec.Public)
	assert.Equal(t, int32(3), *spec.Replicas)
	assert.Equal(t, "refs/heads/main", spec.GitBranch)
	assert.Equal(t, "./start", *spec.RunCommand)

	ApplyRuntimeConfig(&spec, &ent.ServiceConfig{Replicas: 1})
	assert.Empty(t, spec.Hosts)
	assert.Empty(t, spec.Ports)
}
