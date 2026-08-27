package service_service

import (
	"testing"

	"github.com/stretchr/testify/assert"
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
