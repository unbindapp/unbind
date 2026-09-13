package variables_service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

func TestChangedEndpointKeys(t *testing.T) {
	ports := func(ports ...int32) []schema.PortSpec {
		out := make([]schema.PortSpec, len(ports))
		for i, port := range ports {
			out[i] = schema.PortSpec{Port: port}
		}
		return out
	}
	host := func(name string, targetPort int32) schema.HostSpec {
		return schema.HostSpec{Host: name, TargetPort: utils.ToPtr(targetPort)}
	}
	public := func(config *ent.ServiceConfig) *ent.ServiceConfig {
		config.IsPublic = true
		return config
	}
	udp := schema.ProtocolUDP

	tests := []struct {
		name        string
		serviceType schema.ServiceType
		before      *ent.ServiceConfig
		after       *ent.ServiceConfig
		want        []string
	}{
		{
			"unchanged",
			schema.ServiceTypeDockerimage,
			public(&ent.ServiceConfig{Ports: ports(3000), Hosts: []schema.HostSpec{host("a.com", 3000)}}),
			public(&ent.ServiceConfig{Ports: ports(3000), Hosts: []schema.HostSpec{host("a.com", 3000)}}),
			nil,
		},
		{
			"port changed",
			schema.ServiceTypeDockerimage,
			&ent.ServiceConfig{Ports: ports(3000)},
			&ent.ServiceConfig{Ports: ports(4000)},
			[]string{"UNBIND_PORT_PRIVATE", "UNBIND_URL_PRIVATE"},
		},
		{
			"port added",
			schema.ServiceTypeDockerimage,
			&ent.ServiceConfig{Ports: ports(3000)},
			&ent.ServiceConfig{Ports: ports(3000, 4000)},
			[]string{"UNBIND_HOST_PRIVATE_4000", "UNBIND_PORT_PRIVATE_4000", "UNBIND_URL_PRIVATE_4000"},
		},
		{
			"port removed",
			schema.ServiceTypeDockerimage,
			&ent.ServiceConfig{Ports: ports(3000, 4000)},
			&ent.ServiceConfig{Ports: ports(3000)},
			[]string{"UNBIND_HOST_PRIVATE_4000", "UNBIND_PORT_PRIVATE_4000", "UNBIND_URL_PRIVATE_4000"},
		},
		{
			// Naming endpoints by port instead of position is what keeps the surviving
			// port's keys pointing at the same place
			"first port removed leaves the other port's keys alone",
			schema.ServiceTypeDockerimage,
			&ent.ServiceConfig{Ports: ports(3000, 4000)},
			&ent.ServiceConfig{Ports: ports(4000)},
			[]string{"UNBIND_PORT_PRIVATE", "UNBIND_URL_PRIVATE"},
		},
		{
			"udp port ignored",
			schema.ServiceTypeDockerimage,
			&ent.ServiceConfig{Ports: ports(3000)},
			&ent.ServiceConfig{Ports: append(ports(3000), schema.PortSpec{Port: 5000, Protocol: &udp})},
			nil,
		},
		{
			"node port is not an internal port for a non-database",
			schema.ServiceTypeDockerimage,
			&ent.ServiceConfig{Ports: ports(3000)},
			&ent.ServiceConfig{Ports: append(ports(3000), schema.PortSpec{Port: 5000, IsNodePort: true})},
			nil,
		},
		{
			"database keeps its private port when exposed",
			schema.ServiceTypeDatabase,
			&ent.ServiceConfig{Ports: ports(5432)},
			&ent.ServiceConfig{Ports: []schema.PortSpec{{Port: 5432, IsNodePort: true, NodePort: utils.ToPtr[int32](30001)}}},
			nil,
		},
		{
			// The toggle a database's public networking section drives
			"database made public",
			schema.ServiceTypeDatabase,
			&ent.ServiceConfig{Ports: ports(5432)},
			public(&ent.ServiceConfig{Ports: []schema.PortSpec{{Port: 5432, IsNodePort: true, NodePort: utils.ToPtr[int32](30001)}}}),
			[]string{"UNBIND_DATABASE_URL_PUBLIC", "UNBIND_HOST_PUBLIC", "UNBIND_PORT_PUBLIC"},
		},
		{
			"database made private",
			schema.ServiceTypeDatabase,
			public(&ent.ServiceConfig{Ports: []schema.PortSpec{{Port: 5432, IsNodePort: true, NodePort: utils.ToPtr[int32](30001)}}}),
			&ent.ServiceConfig{Ports: ports(5432)},
			[]string{"UNBIND_DATABASE_URL_PUBLIC", "UNBIND_HOST_PUBLIC", "UNBIND_PORT_PUBLIC"},
		},
		{
			"public database gets a new port",
			schema.ServiceTypeDatabase,
			public(&ent.ServiceConfig{Ports: []schema.PortSpec{{Port: 5432, IsNodePort: true, NodePort: utils.ToPtr[int32](30001)}}}),
			public(&ent.ServiceConfig{Ports: []schema.PortSpec{{Port: 5432, IsNodePort: true, NodePort: utils.ToPtr[int32](30002)}}}),
			[]string{"UNBIND_DATABASE_URL_PUBLIC", "UNBIND_PORT_PUBLIC"},
		},
		{
			"host changed",
			schema.ServiceTypeDockerimage,
			public(&ent.ServiceConfig{Hosts: []schema.HostSpec{host("a.com", 3000)}}),
			public(&ent.ServiceConfig{Hosts: []schema.HostSpec{host("b.com", 3000)}}),
			[]string{"UNBIND_HOST_PUBLIC", "UNBIND_URL_PUBLIC"},
		},
		{
			"host added on another port",
			schema.ServiceTypeDockerimage,
			public(&ent.ServiceConfig{Hosts: []schema.HostSpec{host("a.com", 3000)}}),
			public(&ent.ServiceConfig{Hosts: []schema.HostSpec{host("a.com", 3000), host("b.com", 4000)}}),
			[]string{"UNBIND_HOST_PUBLIC_4000", "UNBIND_PORT_PUBLIC_4000", "UNBIND_URL_PUBLIC_4000"},
		},
		{
			"second host on the same port is tiebroken",
			schema.ServiceTypeDockerimage,
			public(&ent.ServiceConfig{Hosts: []schema.HostSpec{host("a.com", 3000)}}),
			public(&ent.ServiceConfig{Hosts: []schema.HostSpec{host("a.com", 3000), host("b.com", 3000)}}),
			[]string{"UNBIND_HOST_PUBLIC_3000_2", "UNBIND_PORT_PUBLIC_3000_2", "UNBIND_URL_PUBLIC_3000_2"},
		},
		{
			"host removed",
			schema.ServiceTypeDockerimage,
			public(&ent.ServiceConfig{Hosts: []schema.HostSpec{host("a.com", 3000)}}),
			public(&ent.ServiceConfig{}),
			[]string{"UNBIND_HOST_PUBLIC", "UNBIND_PORT_PUBLIC", "UNBIND_URL_PUBLIC"},
		},
		{
			"host path change is not a url change",
			schema.ServiceTypeDockerimage,
			public(&ent.ServiceConfig{Hosts: []schema.HostSpec{host("a.com", 3000)}}),
			public(&ent.ServiceConfig{Hosts: []schema.HostSpec{{Host: "a.com", Path: "/api", TargetPort: utils.ToPtr[int32](3000)}}}),
			nil,
		},
		{
			"a private service has no public keys to change",
			schema.ServiceTypeDockerimage,
			&ent.ServiceConfig{Hosts: []schema.HostSpec{host("a.com", 3000)}},
			&ent.ServiceConfig{Hosts: []schema.HostSpec{host("b.com", 3000)}},
			nil,
		},
		{"nil configs", schema.ServiceTypeDockerimage, nil, nil, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, ChangedEndpointKeys(tt.serviceType, tt.before, tt.after))
		})
	}
}
