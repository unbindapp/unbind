package templates

import (
	"regexp"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent/schema"
)

func TestConvexTemplateResolves(t *testing.T) {
	templater := NewTemplater(&config.Config{ExternalUIUrl: "https://example.com"})

	inputs := map[string]string{
		"input_api_domain":          "api.convex.example.com",
		"input_http_actions_domain": "actions.convex.example.com",
		"input_dashboard_domain":    "dashboard.convex.example.com",
		"input_database_size":       "1",
		"input_storage_size":        "1",
	}
	kubeNameMap := map[string]string{
		"service_postgres":  "convex-postgres",
		"service_backend":   "convex-backend",
		"service_dashboard": "convex-dashboard",
	}

	resolved, err := templater.ResolveTemplate(convexTemplate(), inputs, kubeNameMap, "ns")
	require.NoError(t, err)

	vars := map[string]string{}
	var backend, postgres, dashboard *schema.TemplateService
	for i := range resolved.Services {
		svc := &resolved.Services[i]
		switch svc.ID {
		case "service_backend":
			backend = svc
		case "service_postgres":
			postgres = svc
		case "service_dashboard":
			dashboard = svc
		}
	}
	require.NotNil(t, backend)
	require.NotNil(t, postgres)
	require.NotNil(t, dashboard)

	for _, v := range backend.Variables {
		vars[v.Name] = v.Value
	}

	assert.Regexp(t, regexp.MustCompile(`^[0-9a-f]{64}$`), vars["INSTANCE_SECRET"])
	assert.Regexp(t, regexp.MustCompile(`^convex\|[0-9a-f]+$`), vars["CONVEX_SELF_HOSTED_ADMIN_KEY"])
	assert.Equal(t, "https://api.convex.example.com", vars["CONVEX_CLOUD_ORIGIN"])
	assert.Equal(t, "https://actions.convex.example.com", vars["CONVEX_SITE_ORIGIN"])
	assert.Equal(t, "convex", vars["INSTANCE_NAME"])
	assert.Equal(t, "1", vars["DO_NOT_REQUIRE_SSL"])

	require.Len(t, backend.Volumes, 1)
	assert.Equal(t, "/convex/data", backend.Volumes[0].MountPath)

	require.NotNil(t, postgres.DatabaseConfig)
	assert.Equal(t, "convex", postgres.DatabaseConfig.DefaultDatabaseName)
	assert.NotEmpty(t, postgres.DatabaseConfig.StorageSize)

	dashVars := map[string]string{}
	for _, v := range dashboard.Variables {
		dashVars[v.Name] = v.Value
	}
	assert.Equal(t, "https://api.convex.example.com", dashVars["NEXT_PUBLIC_DEPLOYMENT_URL"])
}
