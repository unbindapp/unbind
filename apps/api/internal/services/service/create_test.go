package service_service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func TestResolveIsPublic(t *testing.T) {
	databasePorts := []schema.PortSpec{{Port: 5432}}

	tests := []struct {
		name      string
		requested *bool
		ports     []schema.PortSpec
		want      *bool
	}{
		{name: "database defaults to public", requested: nil, ports: databasePorts, want: new(true)},
		{name: "database kept private on request", requested: new(false), ports: databasePorts, want: new(false)},
		{name: "service with a port defaults to public", requested: nil, ports: []schema.PortSpec{{Port: 8080}}, want: new(true)},
		{name: "service without ports stays undecided", requested: nil, ports: nil, want: nil},
		{name: "request wins without ports", requested: new(true), ports: nil, want: new(true)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isPublic := resolveIsPublic(tt.requested, tt.ports)
			if tt.want == nil {
				assert.Nil(t, isPublic)
				return
			}
			assert.NotNil(t, isPublic)
			assert.Equal(t, *tt.want, *isPublic)
		})
	}
}
