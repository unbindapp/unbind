package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestServiceFQDN(t *testing.T) {
	assert.Equal(t, "web-abc123.unbind-team.svc.cluster.local", ServiceFQDN("web-abc123", "unbind-team"))
	assert.Equal(t, "moco-db-abc123.unbind-team.svc.cluster.local", ServiceFQDN("moco-db-abc123", "unbind-team"))
}
