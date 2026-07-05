// Package router holds the Huma config and route registration shared by the
// running server (cmd/api) and the offline OpenAPI generator (cmd/openapi), so
// the generated spec can't drift from the routes the server serves.
package router

import (
	"net/url"

	"github.com/danielgtaylor/huma/v2"
	"github.com/gorilla/schema"
	"github.com/unbindapp/unbind-api/internal/api/middleware"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/auth"

	auth_handler "github.com/unbindapp/unbind-api/internal/api/handlers/auth"
	deployments_handler "github.com/unbindapp/unbind-api/internal/api/handlers/deployments"
	docker_handler "github.com/unbindapp/unbind-api/internal/api/handlers/docker"
	environments_handler "github.com/unbindapp/unbind-api/internal/api/handlers/environments"
	github_handler "github.com/unbindapp/unbind-api/internal/api/handlers/github"
	groups_handler "github.com/unbindapp/unbind-api/internal/api/handlers/groups"
	instances_handler "github.com/unbindapp/unbind-api/internal/api/handlers/instances"
	logs_handler "github.com/unbindapp/unbind-api/internal/api/handlers/logs"
	metrics_handler "github.com/unbindapp/unbind-api/internal/api/handlers/metrics"
	projects_handler "github.com/unbindapp/unbind-api/internal/api/handlers/projects"
	service_handler "github.com/unbindapp/unbind-api/internal/api/handlers/service"
	servicegroups_handler "github.com/unbindapp/unbind-api/internal/api/handlers/service_groups"
	setup_handler "github.com/unbindapp/unbind-api/internal/api/handlers/setup"
	storage_handler "github.com/unbindapp/unbind-api/internal/api/handlers/storage"
	system_handler "github.com/unbindapp/unbind-api/internal/api/handlers/system"
	teams_handler "github.com/unbindapp/unbind-api/internal/api/handlers/teams"
	template_handler "github.com/unbindapp/unbind-api/internal/api/handlers/templates"
	terminal_handler "github.com/unbindapp/unbind-api/internal/api/handlers/terminal"
	unbindwebhooks_handler "github.com/unbindapp/unbind-api/internal/api/handlers/unbindwebhooks"
	user_handler "github.com/unbindapp/unbind-api/internal/api/handlers/user"
	variables_handler "github.com/unbindapp/unbind-api/internal/api/handlers/variables"
	webhook_handler "github.com/unbindapp/unbind-api/internal/api/handlers/webhook"
)

// Adding a format for form data
var decoder = schema.NewDecoder()
var urlEncodedFormat = huma.Format{
	Marshal: nil,
	Unmarshal: func(data []byte, v any) error {
		values, err := url.ParseQuery(string(data))
		if err != nil {
			return err
		}

		// WARNING: Dirty workaround!
		// During validation, Huma first parses the body into []any, map[string]any or equivalent for easy validation,
		// before parsing it into the target struct.
		// However, gorilla/schema requires a struct for decoding, so we need to map `url.Values` to a
		// `map[string]any` if this happens.
		// See: https://github.com/danielgtaylor/huma/blob/main/huma.go#L1264
		if vPtr, ok := v.(*any); ok {
			m := map[string]any{}
			for k, v := range values {
				if len(v) > 1 {
					m[k] = v
				} else if len(v) == 1 {
					m[k] = v[0]
				}
			}
			*vPtr = m
			return nil
		}

		// `v` is a struct, try decode normally
		return decoder.Decode(v, values)
	},
}

func NewHumaConfig(title, version string, cookieSecure bool) huma.Config {
	schemaPrefix := "#/components/schemas/"
	schemasPath := "/schemas"

	registry := huma.NewMapRegistry(schemaPrefix, huma.DefaultSchemaNamer)

	cfg := huma.Config{
		OpenAPI: &huma.OpenAPI{
			OpenAPI: "3.1.0",
			Info: &huma.Info{
				Title:   title,
				Version: version,
			},
			Components: &huma.Components{
				Schemas: registry,
				SecuritySchemes: map[string]*huma.SecurityScheme{
					"cookieAuth": {
						Type:        "apiKey",
						In:          "cookie",
						Name:        auth.AccessTokenCookieName(cookieSecure),
						Description: "Session cookie set by /auth/login. Sent automatically by browsers.",
					},
					"bearerAuth": {
						Type:         "http",
						Scheme:       "bearer",
						BearerFormat: "JWT",
						Description:  "Access token passed as `Authorization: Bearer <token>`.",
					},
				},
			},
		},
		OpenAPIPath:   "/openapi",
		DocsPath:      "/docs",
		SchemasPath:   schemasPath,
		Formats:       huma.DefaultFormats,
		DefaultFormat: "application/json",
	}
	cfg.Formats["application/x-www-form-urlencoded"] = urlEncodedFormat
	cfg.Formats["x-www-form-urlencoded"] = urlEncodedFormat

	return cfg
}

// RegisterRoutes only wires routes and operation metadata, so it's safe to call
// with an empty *server.Server when generating the spec offline — handlers are
// never invoked here.
func RegisterRoutes(api huma.API, srvImpl *server.Server, mw *middleware.Middleware, allowedOrigins []string) {
	authSecurity := []map[string][]string{
		{"cookieAuth": {}},
		{"bearerAuth": {}},
	}
	register := func(prefix, tag string, authed bool, fn func(*server.Server, *huma.Group)) {
		grp := huma.NewGroup(api, prefix)
		if authed {
			grp.UseMiddleware(mw.Authenticate)
			grp.UseMiddleware(mw.CSRF)
		}
		grp.UseModifier(func(op *huma.Operation, next func(*huma.Operation)) {
			op.Tags = []string{tag}
			if authed {
				op.Security = authSecurity
			}
			next(op)
		})
		fn(srvImpl, grp)
	}

	register("/setup", "Setup", false, setup_handler.RegisterHandlers)
	register("/auth", "Auth", false, auth_handler.RegisterHandlers)
	register("/webhook", "Webhook", false, webhook_handler.RegisterHandlers)
	register("/system", "System", true, system_handler.RegisterHandlers)
	register("/users", "Users", true, user_handler.RegisterHandlers)
	register("/groups", "Groups", true, groups_handler.RegisterHandlers)
	register("/github", "GitHub", true, github_handler.RegisterHandlers)
	register("/teams", "Teams", true, teams_handler.RegisterHandlers)
	register("/projects", "Projects", true, projects_handler.RegisterHandlers)
	register("/environments", "Environments", true, environments_handler.RegisterHandlers)
	register("/service_groups", "Service Groups", true, servicegroups_handler.RegisterHandlers)
	register("/services", "Services", true, service_handler.RegisterHandlers)
	register("/variables", "Variables", true, variables_handler.RegisterHandlers)
	register("/logs", "Logs", true, logs_handler.RegisterHandlers)
	register("/deployments", "Deployments", true, deployments_handler.RegisterHandlers)
	register("/metrics", "Metrics", true, metrics_handler.RegisterHandlers)
	register("/unbindwebhooks", "Unbind Webhooks", true, unbindwebhooks_handler.RegisterHandlers)
	register("/instances", "Instances", true, instances_handler.RegisterHandlers)
	register("/storage", "Storage", true, storage_handler.RegisterHandlers)
	register("/templates", "Templates", true, template_handler.RegisterHandlers)
	register("/docker", "Docker", true, docker_handler.RegisterHandlers)
	register("/terminal", "Terminal", true, func(srv *server.Server, grp *huma.Group) {
		terminal_handler.RegisterHandlers(srv, grp, allowedOrigins)
	})
}
