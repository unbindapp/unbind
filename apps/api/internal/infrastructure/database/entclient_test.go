package database

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func TestNewEntClient(t *testing.T) {
	dbconn, _ := GetSqlDbConn(nil, true)

	client, sqlDB, err := NewEntClient(dbconn)
	assert.Nil(t, err)
	assert.NotNil(t, sqlDB)
	assert.NotNil(t, client)
}

// Inserts through the real client factory instead of enttest, which registers
// ent/runtime itself and would hide a missing blank import (panicked in v0.1.15).
func TestNewEntClientRegistersSchemaDefaults(t *testing.T) {
	dbconn, _ := GetSqlDbConn(nil, true)

	client, _, err := NewEntClient(dbconn)
	require.NoError(t, err)
	require.NoError(t, client.Schema.Create(t.Context()))

	tmpl, err := client.Template.Create().
		SetName("runtime-check").
		SetDescription("check").
		SetIcon("check").
		SetResourceRecommendations(schema.TemplateResourceRecommendations{}).
		SetVersion(1).
		SetDefinition(schema.TemplateDefinition{}).
		Save(t.Context())
	require.NoError(t, err)
	assert.False(t, tmpl.CreatedAt.IsZero())
	assert.NotZero(t, tmpl.ID)
}
