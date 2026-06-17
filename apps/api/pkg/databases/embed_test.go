package databases

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
	assert.Equal(t, "ghcr.io/unbindapp/spilo:18-27713048842", dockerImageProp.Default)

	assert.Contains(t, def.Content, "spilo:%s-27713048842")
}
