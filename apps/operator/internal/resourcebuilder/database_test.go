package resourcebuilder

import (
	"testing"

	"github.com/stretchr/testify/assert"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
)

func TestApplyDbCommonConfigResources(t *testing.T) {
	service := &v1.Service{}
	service.Spec.Config.Database.Type = "postgres"
	service.Spec.Config.Resources = &v1.ResourceSpec{
		CPURequestsMillicores:   50,
		MemoryRequestsMegabytes: 128,
		MemoryLimitsMegabytes:   2048,
	}
	rb := NewResourceBuilder(service, nil, nil)

	dbConfig := map[string]any{}
	rb.applyDbCommonConfig(dbConfig, "1Gi")

	resources := dbConfig["common"].(map[string]any)["resources"].(map[string]any)
	assert.Equal(t, map[string]string{"cpu": "50m", "memory": "128M"}, resources["requests"])
	assert.Equal(t, map[string]string{"memory": "2048M"}, resources["limits"])
}
