package service_service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func TestResolveIsPublic(t *testing.T) {
	databasePorts := []schema.PortSpec{{Port: 5432}}

	tests := []struct {
		name        string
		requested   *bool
		serviceType schema.ServiceType
		ports       []schema.PortSpec
		want        *bool
	}{
		{name: "database defaults to private", requested: nil, serviceType: schema.ServiceTypeDatabase, ports: databasePorts, want: new(false)},
		{name: "database made public on request", requested: new(true), serviceType: schema.ServiceTypeDatabase, ports: databasePorts, want: new(true)},
		{name: "database kept private on request", requested: new(false), serviceType: schema.ServiceTypeDatabase, ports: databasePorts, want: new(false)},
		{name: "service with a port defaults to public", requested: nil, serviceType: schema.ServiceTypeDockerimage, ports: []schema.PortSpec{{Port: 8080}}, want: new(true)},
		{name: "service without ports stays undecided", requested: nil, serviceType: schema.ServiceTypeDockerimage, ports: nil, want: nil},
		{name: "request wins without ports", requested: new(true), serviceType: schema.ServiceTypeDockerimage, ports: nil, want: new(true)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isPublic := resolveIsPublic(tt.requested, tt.serviceType, tt.ports)
			if tt.want == nil {
				assert.Nil(t, isPublic)
				return
			}
			assert.NotNil(t, isPublic)
			assert.Equal(t, *tt.want, *isPublic)
		})
	}
}

func TestResolveAutoDeploy(t *testing.T) {
	tests := []struct {
		name        string
		requested   *bool
		serviceType schema.ServiceType
		want        *bool
	}{
		{name: "github defaults to on", requested: nil, serviceType: schema.ServiceTypeGithub, want: new(true)},
		{name: "github turned off on request", requested: new(false), serviceType: schema.ServiceTypeGithub, want: new(false)},
		{name: "image stays undecided", requested: nil, serviceType: schema.ServiceTypeDockerimage, want: nil},
		{name: "database stays undecided", requested: nil, serviceType: schema.ServiceTypeDatabase, want: nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			autoDeploy := resolveAutoDeploy(tt.requested, tt.serviceType)
			if tt.want == nil {
				assert.Nil(t, autoDeploy)
				return
			}
			assert.NotNil(t, autoDeploy)
			assert.Equal(t, *tt.want, *autoDeploy)
		})
	}
}
