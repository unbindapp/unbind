package metric_service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/infrastructure/prometheus"
	"github.com/unbindapp/unbind-api/internal/models"
)

func TestPermissionCheckForType(t *testing.T) {
	teamID := uuid.New()
	projectID := uuid.New()
	environmentID := uuid.New()
	serviceID := uuid.New()
	full := models.MetricsQueryInput{
		TeamID:        teamID,
		ProjectID:     projectID,
		EnvironmentID: environmentID,
		ServiceID:     serviceID,
	}

	cases := []struct {
		metricsType  models.MetricsType
		resourceType schema.ResourceType
		resourceID   uuid.UUID
	}{
		{models.MetricsTypeTeam, schema.ResourceTypeTeam, teamID},
		{models.MetricsTypeProject, schema.ResourceTypeProject, projectID},
		{models.MetricsTypeEnvironment, schema.ResourceTypeEnvironment, environmentID},
		{models.MetricsTypeService, schema.ResourceTypeService, serviceID},
	}

	for _, c := range cases {
		t.Run(string(c.metricsType), func(t *testing.T) {
			input := full
			input.Type = c.metricsType
			check, err := permissionCheckForType(&input)
			require.NoError(t, err)
			assert.Equal(t, schema.ActionViewer, check.Action)
			assert.Equal(t, c.resourceType, check.ResourceType)
			assert.Equal(t, c.resourceID, check.ResourceID)
		})
	}
}

func TestPermissionCheckForType_MissingID(t *testing.T) {
	cases := []struct {
		name  string
		input models.MetricsQueryInput
	}{
		{"team", models.MetricsQueryInput{Type: models.MetricsTypeTeam}},
		{"project", models.MetricsQueryInput{Type: models.MetricsTypeProject, TeamID: uuid.New()}},
		{"environment", models.MetricsQueryInput{Type: models.MetricsTypeEnvironment, TeamID: uuid.New(), ProjectID: uuid.New()}},
		{"service", models.MetricsQueryInput{Type: models.MetricsTypeService, TeamID: uuid.New(), ProjectID: uuid.New(), EnvironmentID: uuid.New()}},
		{"unknown type", models.MetricsQueryInput{Type: models.MetricsType("cluster"), TeamID: uuid.New()}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := permissionCheckForType(&c.input)
			assert.Error(t, err)
		})
	}
}

func TestMetricsByServerName(t *testing.T) {
	cpu := &prometheus.NodeMetrics{}
	ram := &prometheus.NodeMetrics{}
	metrics := map[string]*prometheus.NodeMetrics{
		"10.0.0.1:9100":  cpu,
		"[fd00::1]:9100": ram,
		"10.0.0.9:9100":  {},
		"without-a-port": {},
	}
	namesByIP := map[string]string{"10.0.0.1": "cp", "fd00::1": "worker", "without-a-port": "odd"}

	result := metricsByServerName(metrics, namesByIP)

	assert.Equal(t, cpu, result["cp"])
	assert.Equal(t, ram, result["worker"])
	assert.Contains(t, result, "odd", "an instance without a port falls back to the whole label")
	assert.NotContains(t, result, "10.0.0.9", "instances of unknown servers are dropped")
	assert.Len(t, result, 3)
}
