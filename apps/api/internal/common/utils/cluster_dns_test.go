package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestServiceFQDN(t *testing.T) {
	assert.Equal(t, "web-abc123.unbind-team.svc.cluster.local", ServiceFQDN("web-abc123", "unbind-team"))
	assert.Equal(t, "moco-db-abc123.unbind-team.svc.cluster.local", ServiceFQDN("moco-db-abc123", "unbind-team"))
}

func TestInternalServiceName(t *testing.T) {
	cases := map[string]string{
		"":           "svc-abc",
		"postgres":   "svc-abc",
		"mongodb":    "svc-abc",
		"mysql":      "moco-svc-abc-primary",
		"redis":      "svc-abc-headless",
		"clickhouse": "clickhouse-svc-abc",
	}
	for databaseType, expected := range cases {
		if got := InternalServiceName(databaseType, "svc-abc"); got != expected {
			t.Errorf("InternalServiceName(%q) = %q, want %q", databaseType, got, expected)
		}
	}
}
