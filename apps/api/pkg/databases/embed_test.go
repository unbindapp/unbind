package databases

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"sigs.k8s.io/yaml"
)

func TestEmbeddedDatabaseList(t *testing.T) {
	provider := NewDatabaseProvider()

	list, err := provider.ListDatabases(context.Background(), "")
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"postgres", "redis", "mysql", "mongodb", "clickhouse"}, list)
}

func TestEmbeddedPostgresDefinitionPG18(t *testing.T) {
	provider := NewDatabaseProvider()

	def, err := provider.FetchDatabaseDefinition(context.Background(), "", "postgres")
	require.NoError(t, err)
	require.NotNil(t, def)

	versionProp, ok := def.Schema.Properties["version"]
	require.True(t, ok, "postgres schema should expose a version property")
	assert.Equal(t, "18", versionProp.Default)
	assert.Contains(t, versionProp.Enum, "18")

	dockerImageProp, ok := def.Schema.Properties["dockerImage"]
	require.True(t, ok, "postgres schema should expose a dockerImage property")
	assert.Equal(t, "", dockerImageProp.Default)

	assert.Contains(t, def.Content, "spilo:%s-32904760118")
}

func TestEmbeddedRedisDefinitionLabelsPersistentVolumeClaims(t *testing.T) {
	provider := NewDatabaseProvider()

	def, err := provider.FetchDatabaseDefinition(context.Background(), "", "redis")
	require.NoError(t, err)
	require.NotNil(t, def)

	result, err := NewDatabaseRenderer().Render(def, &RenderContext{
		Name:      "redis-test",
		Namespace: "unbind-user",
		TeamID:    "team-1",
		Parameters: map[string]any{
			"secretName": "redis-secret",
			"secretKey":  "DATABASE_PASSWORD",
			"labels": map[string]any{
				"unbind-team":    "team-1",
				"unbind-service": "svc-1",
				"custom":         "ignored",
			},
		},
		Definition: *def,
	})
	require.NoError(t, err)

	var release struct {
		Spec struct {
			Values struct {
				Persistence struct {
					Labels map[string]string `json:"labels"`
				} `json:"persistence"`
			} `json:"values"`
		} `json:"spec"`
	}
	require.NoError(t, yaml.Unmarshal([]byte(strings.Split(result, "\n---\n")[1]), &release))
	assert.Equal(t, map[string]string{"unbind-team": "team-1", "unbind-service": "svc-1"}, release.Spec.Values.Persistence.Labels)
}

// unbind-deployment changes every deploy; it must stay off the pod template or the
// StatefulSet rolls the database on every redeploy.
func renderDBWithDeploymentLabel(t *testing.T, dbType string) string {
	t.Helper()
	provider := NewDatabaseProvider()

	def, err := provider.FetchDatabaseDefinition(context.Background(), "", dbType)
	require.NoError(t, err)
	require.NotNil(t, def)

	result, err := NewDatabaseRenderer().Render(def, &RenderContext{
		Name:      dbType + "-test",
		Namespace: "unbind-user",
		TeamID:    "team-1",
		Parameters: map[string]any{
			"secretName": "db-secret",
			"secretKey":  "DATABASE_PASSWORD",
			"labels": map[string]any{
				"unbind-team":       "team-1",
				"unbind-service":    "svc-1",
				"unbind-deployment": "dep-1",
			},
		},
		Definition: *def,
	})
	require.NoError(t, err)
	return result
}

func TestEmbeddedMySQLDefinitionPodLabelsExcludeDeployment(t *testing.T) {
	result := renderDBWithDeploymentLabel(t, "mysql")

	var cluster struct {
		Kind string `json:"kind"`
		Spec struct {
			PodTemplate struct {
				Metadata struct {
					Labels map[string]string `json:"labels"`
				} `json:"metadata"`
			} `json:"podTemplate"`
		} `json:"spec"`
	}
	for doc := range strings.SplitSeq(result, "\n---\n") {
		if err := yaml.Unmarshal([]byte(doc), &cluster); err != nil || cluster.Kind != "MySQLCluster" {
			continue
		}
		labels := cluster.Spec.PodTemplate.Metadata.Labels
		assert.Equal(t, "svc-1", labels["unbind-service"])
		assert.NotContains(t, labels, "unbind-deployment")
		return
	}
	t.Fatal("MySQLCluster document not found in rendered output")
}

func TestEmbeddedMongoDBDefinitionPodLabelsExcludeDeployment(t *testing.T) {
	result := renderDBWithDeploymentLabel(t, "mongodb")

	var release struct {
		Spec struct {
			Values struct {
				PodLabels map[string]string `json:"podLabels"`
			} `json:"values"`
		} `json:"spec"`
	}
	require.NoError(t, yaml.Unmarshal([]byte(strings.Split(result, "\n---\n")[1]), &release))
	assert.Equal(t, "svc-1", release.Spec.Values.PodLabels["unbind-service"])
	assert.NotContains(t, release.Spec.Values.PodLabels, "unbind-deployment")
}
