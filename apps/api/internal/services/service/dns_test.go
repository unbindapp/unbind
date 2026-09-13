package service_service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/models"
)

func TestNodePortBridge(t *testing.T) {
	ports := []schema.PortSpec{
		{Port: 8080},
		{Port: 6379, IsNodePort: true, NodePort: new(int32(32388))},
	}

	tests := []struct {
		name       string
		targetPort *int32
		want       *int32
	}{
		{name: "nil target port", targetPort: nil, want: nil},
		{name: "bridged port", targetPort: new(int32(6379)), want: new(int32(32388))},
		{name: "plain port", targetPort: new(int32(8080)), want: nil},
		{name: "unknown port", targetPort: new(int32(9000)), want: nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			bridge := nodePortBridge(ports, tt.targetPort)
			if tt.want == nil {
				assert.Nil(t, bridge)
				return
			}
			assert.NotNil(t, bridge)
			assert.Equal(t, *tt.want, *bridge.NodePort)
		})
	}
}

func TestAttachHostToL4Endpoints(t *testing.T) {
	external := []models.IngressEndpoint{
		{IsIngress: true, Host: "app.example.com", TargetPort: &schema.PortSpec{Port: 32388}},
		{IsIngress: false, Host: "1.2.3.4", TargetPort: &schema.PortSpec{Port: 32388}},
		{IsIngress: false, Host: "1.2.3.4", TargetPort: &schema.PortSpec{Port: 30000}},
		{IsIngress: false, Host: "1.2.3.4"},
	}

	attached := attachHostToL4Endpoints(external, "redis.example.com", 32388)

	assert.True(t, attached)
	assert.Equal(t, "app.example.com", external[0].Host)
	assert.Equal(t, "redis.example.com", external[1].Host)
	assert.Equal(t, "1.2.3.4", external[2].Host)
	assert.Equal(t, "1.2.3.4", external[3].Host)

	assert.False(t, attachHostToL4Endpoints(external, "redis.example.com", 31111))
}

func TestAppendClusterAddressEndpoints(t *testing.T) {
	team := &ent.Team{ID: uuid.New()}
	project := &ent.Project{ID: uuid.New(), Edges: ent.ProjectEdges{Team: team}}
	env := &ent.Environment{ID: uuid.New()}

	newService := func(isPublic bool, ports []schema.PortSpec) *ent.Service {
		return &ent.Service{
			ID:             uuid.New(),
			KubernetesName: "redis-abc",
			Edges: ent.ServiceEdges{
				ServiceConfig: &ent.ServiceConfig{IsPublic: isPublic, Ports: ports},
			},
		}
	}

	bridged := []schema.PortSpec{
		{Port: 6379, IsNodePort: true, NodePort: new(int32(32388))},
		{Port: 8080},
	}

	tests := []struct {
		name      string
		service   *ent.Service
		address   string
		external  []models.IngressEndpoint
		wantHosts []string
		wantPorts []int32
	}{
		{
			name:    "allocated node port is reachable at the cluster address",
			service: newService(true, bridged),
			address: "1.2.3.4",
			// The container port is never an external endpoint on its own
			wantHosts: []string{"1.2.3.4"},
			wantPorts: []int32{32388},
		},
		{
			name:      "private service exposes nothing",
			service:   newService(false, bridged),
			address:   "1.2.3.4",
			wantHosts: []string{},
			wantPorts: []int32{},
		},
		{
			name:      "no allocated port, nothing to infer",
			service:   newService(true, []schema.PortSpec{{Port: 8080}}),
			address:   "1.2.3.4",
			wantHosts: []string{},
			wantPorts: []int32{},
		},
		{
			name:      "discovered endpoint is not duplicated",
			service:   newService(true, bridged),
			address:   "1.2.3.4",
			external:  []models.IngressEndpoint{{Host: "1.2.3.4", TargetPort: &schema.PortSpec{Port: 32388}}},
			wantHosts: []string{"1.2.3.4"},
			wantPorts: []int32{32388},
		},
		{
			name:      "host fronting the port wins",
			service:   newService(true, bridged),
			address:   "1.2.3.4",
			external:  []models.IngressEndpoint{{Host: "redis.example.com", TargetPort: &schema.PortSpec{Port: 32388}}},
			wantHosts: []string{"redis.example.com"},
			wantPorts: []int32{32388},
		},
		{
			name:      "an ingress on the same number is not an L4 endpoint",
			service:   newService(true, bridged),
			address:   "1.2.3.4",
			external:  []models.IngressEndpoint{{IsIngress: true, Host: "app.example.com", TargetPort: &schema.PortSpec{Port: 32388}}},
			wantHosts: []string{"app.example.com", "1.2.3.4"},
			wantPorts: []int32{32388, 32388},
		},
		{
			name:      "unresolvable cluster address adds nothing",
			service:   newService(true, bridged),
			address:   "",
			wantHosts: []string{},
			wantPorts: []int32{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			endpoints := &models.EndpointDiscovery{External: tt.external}
			appendClusterAddressEndpoints(endpoints, tt.service, project, env, func() string { return tt.address })

			hosts := make([]string, 0, len(endpoints.External))
			ports := make([]int32, 0, len(endpoints.External))
			for _, endpoint := range endpoints.External {
				hosts = append(hosts, endpoint.Host)
				ports = append(ports, endpoint.TargetPort.Port)
			}
			assert.Equal(t, tt.wantHosts, hosts)
			assert.Equal(t, tt.wantPorts, ports)
		})
	}
}

func TestAppendClusterAddressEndpointsResolvesAddressOnlyWhenNeeded(t *testing.T) {
	team := &ent.Team{ID: uuid.New()}
	project := &ent.Project{ID: uuid.New(), Edges: ent.ProjectEdges{Team: team}}
	env := &ent.Environment{ID: uuid.New()}
	service := &ent.Service{
		ID: uuid.New(),
		Edges: ent.ServiceEdges{
			ServiceConfig: &ent.ServiceConfig{IsPublic: true, Ports: []schema.PortSpec{{Port: 8080}}},
		},
	}

	calls := 0
	appendClusterAddressEndpoints(&models.EndpointDiscovery{}, service, project, env, func() string {
		calls++
		return "1.2.3.4"
	})

	assert.Equal(t, 0, calls)
}
