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
	hosts := func(hosts ...string) []schema.HostSpec {
		out := make([]schema.HostSpec, len(hosts))
		for i, host := range hosts {
			out[i] = schema.HostSpec{Host: host}
		}
		return out
	}
	udp := schema.ProtocolUDP

	tests := []struct {
		name        string
		serviceType schema.ServiceType
		before      *ent.ServiceConfig
		after       *ent.ServiceConfig
		want        []string
	}{
		{"unchanged", schema.ServiceTypeDockerimage, &ent.ServiceConfig{Ports: ports(3000), Hosts: hosts("a.com")}, &ent.ServiceConfig{Ports: ports(3000), Hosts: hosts("a.com")}, nil},
		{"port changed", schema.ServiceTypeDockerimage, &ent.ServiceConfig{Ports: ports(3000)}, &ent.ServiceConfig{Ports: ports(4000)}, []string{"UNBIND_INTERNAL_URL", "UNBIND_INTERNAL_PORT"}},
		{"port added", schema.ServiceTypeDockerimage, &ent.ServiceConfig{Ports: ports(3000)}, &ent.ServiceConfig{Ports: ports(3000, 4000)}, []string{"UNBIND_INTERNAL_URL_2", "UNBIND_INTERNAL_PORT_2"}},
		{"port removed", schema.ServiceTypeDockerimage, &ent.ServiceConfig{Ports: ports(3000, 4000)}, &ent.ServiceConfig{Ports: ports(3000)}, []string{"UNBIND_INTERNAL_URL_2", "UNBIND_INTERNAL_PORT_2"}},
		{"first port removed shifts the rest", schema.ServiceTypeDockerimage, &ent.ServiceConfig{Ports: ports(3000, 4000)}, &ent.ServiceConfig{Ports: ports(4000)}, []string{"UNBIND_INTERNAL_URL", "UNBIND_INTERNAL_PORT", "UNBIND_INTERNAL_URL_2", "UNBIND_INTERNAL_PORT_2"}},
		{"udp port ignored", schema.ServiceTypeDockerimage, &ent.ServiceConfig{Ports: ports(3000)}, &ent.ServiceConfig{Ports: append(ports(3000), schema.PortSpec{Port: 5000, Protocol: &udp})}, nil},
		{"node port ignored for non-database", schema.ServiceTypeDockerimage, &ent.ServiceConfig{Ports: ports(3000)}, &ent.ServiceConfig{Ports: append(ports(3000), schema.PortSpec{Port: 5000, IsNodePort: true})}, nil},
		{"database keeps its port when exposed", schema.ServiceTypeDatabase, &ent.ServiceConfig{Ports: ports(5432)}, &ent.ServiceConfig{Ports: []schema.PortSpec{{Port: 5432, IsNodePort: true, NodePort: utils.ToPtr[int32](30001)}}}, nil},
		{"host changed", schema.ServiceTypeDockerimage, &ent.ServiceConfig{Hosts: hosts("a.com")}, &ent.ServiceConfig{Hosts: hosts("b.com")}, []string{"UNBIND_EXTERNAL_URL"}},
		{"host added", schema.ServiceTypeDockerimage, &ent.ServiceConfig{Hosts: hosts("a.com")}, &ent.ServiceConfig{Hosts: hosts("a.com", "b.com")}, []string{"UNBIND_EXTERNAL_URL_2"}},
		{"host removed", schema.ServiceTypeDockerimage, &ent.ServiceConfig{Hosts: hosts("a.com")}, &ent.ServiceConfig{}, []string{"UNBIND_EXTERNAL_URL"}},
		{"host path change is not a url change", schema.ServiceTypeDockerimage, &ent.ServiceConfig{Hosts: hosts("a.com")}, &ent.ServiceConfig{Hosts: []schema.HostSpec{{Host: "a.com", Path: "/api"}}}, nil},
		{"nil configs", schema.ServiceTypeDockerimage, nil, nil, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, ChangedEndpointKeys(tt.serviceType, tt.before, tt.after))
		})
	}
}
