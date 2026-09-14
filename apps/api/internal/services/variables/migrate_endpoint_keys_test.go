package variables_service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

func TestRelabelledEndpointKey(t *testing.T) {
	clickhouse := &ent.Service{Type: schema.ServiceTypeDatabase, Database: utils.ToPtr("clickhouse")}
	postgres := &ent.Service{Type: schema.ServiceTypeDatabase, Database: utils.ToPtr("postgres")}
	app := &ent.Service{Type: schema.ServiceTypeDockerimage}

	tests := []struct {
		name    string
		service *ent.Service
		key     string
		want    string
	}{
		{"http port becomes the protocol", clickhouse, "UNBIND_DATABASE_URL_PRIVATE_8123", "UNBIND_DATABASE_URL_PRIVATE_HTTP"},
		{"primary port becomes the bare key", clickhouse, "UNBIND_PORT_PUBLIC_9000", "UNBIND_PORT_PUBLIC"},
		{"a tiebreaker survives a label", clickhouse, "UNBIND_HOST_PUBLIC_8123_2", "UNBIND_HOST_PUBLIC_HTTP_2"},
		{"a tiebreaker the bare key cannot carry is left alone", clickhouse, "UNBIND_HOST_PUBLIC_9000_2", ""},
		{"an already labelled key is left alone", clickhouse, "UNBIND_DATABASE_URL_PUBLIC_HTTP", ""},
		{"a port the engine does not answer on is left alone", clickhouse, "UNBIND_PORT_PRIVATE_5432", ""},
		{"a single protocol engine loses the redundant port", postgres, "UNBIND_DATABASE_URL_PRIVATE_5432", "UNBIND_DATABASE_URL_PRIVATE"},
		{"an app port is the only name it has", app, "UNBIND_URL_PRIVATE_8080", ""},
		{"a stored key is not an endpoint key", clickhouse, "DATABASE_URL", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, relabelledEndpointKey(tt.service, tt.key))
		})
	}
}
