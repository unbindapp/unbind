package templates_service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/vartemplate"
)

func TestTemplateReferenceValue(t *testing.T) {
	id := uuid.New()
	app := &ent.Service{ID: id, Type: schema.ServiceTypeDockerimage}
	db := &ent.Service{ID: id, Type: schema.ServiceTypeDatabase, Database: new("postgres")}

	tests := []struct {
		name string
		ref  schema.TemplateVariableReference
		src  *ent.Service
		want string
	}{
		{
			name: "host reference to a container resolves to the internal URL",
			ref:  schema.TemplateVariableReference{IsHost: true, TargetName: "API_EXTERNAL_URL"},
			src:  app,
			want: vartemplate.ServiceToken(id, vartemplate.KeyInternalURL),
		},
		{
			name: "host reference to a database resolves to the internal host",
			ref:  schema.TemplateVariableReference{IsHost: true, TargetName: "DB_HOST"},
			src:  db,
			want: vartemplate.ServiceToken(id, vartemplate.KeyInternalHost),
		},
		{
			name: "plain reference copies the source variable",
			ref:  schema.TemplateVariableReference{SourceName: "DATABASE_PASSWORD", TargetName: "DB_PASSWORD"},
			src:  db,
			want: vartemplate.ServiceToken(id, "DATABASE_PASSWORD"),
		},
		{
			name: "template string replaces source and additional keys",
			ref: schema.TemplateVariableReference{
				SourceName:                "DATABASE_HOST",
				AdditionalTemplateSources: []string{"DATABASE_PORT"},
				TargetName:                "DB_URL",
				TemplateString:            "postgres://u:p@${DATABASE_HOST}:${DATABASE_PORT}/db",
			},
			src:  db,
			want: "postgres://u:p@" + vartemplate.ServiceToken(id, "DATABASE_HOST") + ":" + vartemplate.ServiceToken(id, "DATABASE_PORT") + "/db",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, templateReferenceValue(tc.ref, tc.src))
		})
	}
}
