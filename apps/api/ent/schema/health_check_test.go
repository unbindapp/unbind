package schema

import (
	"testing"

	"github.com/stretchr/testify/assert"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
)

func TestAsV1HealthCheck(t *testing.T) {
	var unset *HealthCheck
	assert.Nil(t, unset.AsV1HealthCheck())

	assert.Nil(t, (&HealthCheck{Type: new(HealthCheckTypeNone)}).AsV1HealthCheck(), "none is no check")

	defaulted := (&HealthCheck{Path: "/sping"}).AsV1HealthCheck()
	assert.Equal(t, "http", defaulted.Type)
	assert.Equal(t, "/sping", defaulted.Path)

	exec := (&HealthCheck{Type: new(HealthCheckTypeExec), Command: "true"}).AsV1HealthCheck()
	assert.Equal(t, "exec", exec.Type)
	assert.Equal(t, "true", exec.Command)
}

func TestAsV1VariableMounts(t *testing.T) {
	assert.Nil(t, AsV1VariableMounts(nil))
	assert.Nil(t, AsV1VariableMounts([]*VariableMount{}))
	assert.Equal(t,
		[]v1.VariableMountSpec{{Name: "CERT", Path: "/etc/cert.pem"}},
		AsV1VariableMounts([]*VariableMount{{Name: "CERT", Path: "/etc/cert.pem"}}),
	)
}
