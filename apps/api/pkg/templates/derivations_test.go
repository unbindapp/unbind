package templates

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func templateServiceByID(t *testing.T, definition *schema.TemplateDefinition, id string) schema.TemplateService {
	t.Helper()
	for _, service := range definition.Services {
		if service.ID == id {
			return service
		}
	}
	require.Failf(t, "service not found", "%s has no service %s", definition.Name, id)
	return schema.TemplateService{}
}

func TestVariableDerivations(t *testing.T) {
	t.Run("convex admin key follows the instance secret", func(t *testing.T) {
		derivations := VariableDerivations(templateServiceByID(t, convexTemplate(), "service_backend"))
		assert.Equal(t, map[string]*schema.VariableDerivation{
			"CONVEX_SELF_HOSTED_ADMIN_KEY": {
				Type:               schema.VariableDerivationConvexAdminKey,
				Sources:            []string{"INSTANCE_SECRET"},
				ConvexInstanceName: "convex",
			},
		}, derivations)
	})

	t.Run("supabase keys follow the jwt secret and kong.yml follows what it embeds", func(t *testing.T) {
		derivations := VariableDerivations(templateServiceByID(t, supabaseTemplate(), "service_kong"))
		assert.Equal(t, map[string]*schema.VariableDerivation{
			"SUPABASE_ANON_KEY": {
				Type: schema.VariableDerivationJWT, Sources: []string{"JWT_SECRET"}, JWTIssuer: "supabase", JWTRole: "anon",
			},
			"SUPABASE_SERVICE_KEY": {
				Type: schema.VariableDerivationJWT, Sources: []string{"JWT_SECRET"}, JWTIssuer: "supabase", JWTRole: "service_role",
			},
			"kong.yml": {
				Type:    schema.VariableDerivationEmbedded,
				Sources: []string{"DASHBOARD_PASSWORD", "DASHBOARD_USERNAME", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_KEY"},
			},
		}, derivations)
	})

	t.Run("gluetun proxy url follows the proxy password", func(t *testing.T) {
		derivations := VariableDerivations(templateServiceByID(t, gluetunTemplate(), "service_gluetun"))
		assert.Equal(t, map[string]*schema.VariableDerivation{
			"HTTP_PROXY_URL": {Type: schema.VariableDerivationEmbedded, Sources: []string{"HTTPPROXY_PASSWORD"}},
		}, derivations)
	})

	t.Run("a service without derived values has none", func(t *testing.T) {
		assert.Empty(t, VariableDerivations(templateServiceByID(t, supabaseTemplate(), "service_postgresql")))
	})
}
