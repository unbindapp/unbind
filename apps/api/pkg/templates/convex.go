package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// convexTemplate returns the predefined Convex template. INSTANCE_NAME must stay
// underscore-free so the derived DB name matches the Zalando credentials secret
// (Zalando rewrites "_" to "-").
func convexTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "Convex",
		DisplayRank: uint(21000),
		Icon:        "convex",
		Keywords:    []string{"convex", "backend", "database", "reactive", "realtime", "serverless", "typescript", "baas", "firebase", "supabase"},
		Description: "Open-source reactive backend with a database, functions, and realtime sync.",
		Version:     1,
		ResourceRecommendations: schema.TemplateResourceRecommendations{
			MinimumCPUs:  2,
			MinimumRAMGB: 2,
		},
		Inputs: []schema.TemplateInput{
			{
				ID:          "input_dashboard_domain",
				Name:        "Dashboard Domain",
				Type:        schema.InputTypeHost,
				Description: "Domain for the Convex dashboard.",
				Required:    true,
				TargetPort:  utils.ToPtr(6791),
			},
			{
				ID:          "input_api_domain",
				Name:        "Cloud Domain",
				Type:        schema.InputTypeHost,
				Description: "Domain for the Convex cloud API and sync.",
				Required:    true,
				TargetPort:  utils.ToPtr(3210),
			},
			{
				ID:          "input_http_actions_domain",
				Name:        "HTTP Actions Domain",
				Type:        schema.InputTypeHost,
				Description: "Domain for Convex HTTP actions.",
				Required:    true,
				TargetPort:  utils.ToPtr(3211),
			},
			{
				ID:          "input_database_size",
				Name:        "Database Size",
				Type:        schema.InputTypeDatabaseSize,
				Description: "PostgreSQL storage size.",
				Required:    true,
				Default:     utils.ToPtr("1"),
			},
			{
				ID:   "input_storage_size",
				Name: "Storage Size",
				Type: schema.InputTypeVolumeSize,
				Volume: &schema.TemplateVolume{
					Name:      "convex-data",
					MountPath: "/convex/data",
				},
				Description: "Disk for file storage, exports, and indexes.",
				Required:    true,
				Default:     utils.ToPtr("1"),
			},
		},
		Services: []schema.TemplateService{
			{
				ID:           "service_postgres",
				Name:         "PostgreSQL",
				DisplayRank:  1000,
				InputIDs:     []string{"input_database_size"},
				Type:         schema.ServiceTypeDatabase,
				Builder:      schema.ServiceBuilderDatabase,
				DatabaseType: utils.ToPtr("postgres"),
				DatabaseConfig: &schema.DatabaseConfig{
					DefaultDatabaseName: "convex",
					Version:             "17",
				},
			},
			{
				ID:          "service_backend",
				Name:        "Convex Backend",
				Icon:        "convex",
				DisplayRank: 200,
				DependsOn:   []string{"service_postgres"},
				InputIDs:    []string{"input_api_domain", "input_http_actions_domain", "input_storage_size"},
				Type:        schema.ServiceTypeDockerimage,
				Builder:     schema.ServiceBuilderDocker,
				Image:       utils.ToPtr("ghcr.io/get-convex/convex-backend@sha256:edd7959f3464ed661f6663f646db205d5d61bda606c969b074dfb3c69ed71463"),
				Resources: &schema.Resources{
					CPURequestsMillicores:   50,
					CPULimitsMillicores:     1000,
					MemoryRequestsMegabytes: 256,
					MemoryLimitsMegabytes:   2048,
				},
				Ports: []schema.PortSpec{
					{
						Port:     3210,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
					{
						Port:     3211,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				},
				HealthCheck: &schema.HealthCheck{
					Type:                    utils.ToPtr(schema.HealthCheckTypeHTTP),
					Path:                    "/version",
					Port:                    utils.ToPtr(int32(3210)),
					StartupPeriodSeconds:    utils.ToPtr(int32(5)),
					StartupTimeoutSeconds:   utils.ToPtr(int32(5)),
					StartupFailureThreshold: utils.ToPtr(int32(20)),
					HealthPeriodSeconds:     utils.ToPtr(int32(10)),
					HealthTimeoutSeconds:    utils.ToPtr(int32(5)),
					HealthFailureThreshold:  utils.ToPtr(int32(5)),
				},
				ProtectedVariables: []string{"INSTANCE_SECRET", "CONVEX_SELF_HOSTED_ADMIN_KEY"},
				VariableReferences: []schema.TemplateVariableReference{
					{
						SourceID:                  "service_postgres",
						SourceName:                "DATABASE_HOST",
						TargetName:                "POSTGRES_URL",
						AdditionalTemplateSources: []string{"DATABASE_USERNAME", "DATABASE_PASSWORD"},
						TemplateString:            "postgresql://${DATABASE_USERNAME}:${DATABASE_PASSWORD}@${DATABASE_HOST}:5432?sslmode=disable",
					},
				},
				Variables: []schema.TemplateVariable{
					{
						Name:  "INSTANCE_NAME",
						Value: "convex",
					},
					{
						// Emits INSTANCE_SECRET and CONVEX_SELF_HOSTED_ADMIN_KEY.
						Name: "CONVEX_GENERATED_KEYS",
						Generator: &schema.ValueGenerator{
							Type: schema.GeneratorTypeConvexAdminKey,
							ConvexParams: &schema.ConvexAdminKeyParams{
								InstanceName:      "convex",
								SecretOutputKey:   "INSTANCE_SECRET",
								AdminKeyOutputKey: "CONVEX_SELF_HOSTED_ADMIN_KEY",
							},
						},
					},
					{
						Name:  "DO_NOT_REQUIRE_SSL",
						Value: "1",
					},
					{
						Name:  "DISABLE_BEACON",
						Value: "true",
					},
					{
						Name:  "RUST_LOG",
						Value: "info",
					},
					{
						Name: "CONVEX_CLOUD_ORIGIN",
						Generator: &schema.ValueGenerator{
							Type:      schema.GeneratorTypeInput,
							InputID:   "input_api_domain",
							AddPrefix: "https://",
						},
					},
					{
						Name: "CONVEX_SITE_ORIGIN",
						Generator: &schema.ValueGenerator{
							Type:      schema.GeneratorTypeInput,
							InputID:   "input_http_actions_domain",
							AddPrefix: "https://",
						},
					},
					{
						Name: "CONVEX_SELF_HOSTED_URL",
						Generator: &schema.ValueGenerator{
							Type:      schema.GeneratorTypeInput,
							InputID:   "input_api_domain",
							AddPrefix: "https://",
						},
					},
				},
			},
			{
				ID:          "service_dashboard",
				Name:        "Convex Dashboard",
				Icon:        "convex",
				DisplayRank: 100,
				DependsOn:   []string{"service_backend"},
				InputIDs:    []string{"input_dashboard_domain"},
				Type:        schema.ServiceTypeDockerimage,
				Builder:     schema.ServiceBuilderDocker,
				Image:       utils.ToPtr("ghcr.io/get-convex/convex-dashboard@sha256:bbc4d2c43d19fd6f2791dd6c5153a76e127f3eea489c1639e5acf66999c216bf"),
				Resources: &schema.Resources{
					CPURequestsMillicores:   20,
					CPULimitsMillicores:     400,
					MemoryRequestsMegabytes: 128,
					MemoryLimitsMegabytes:   512,
				},
				Ports: []schema.PortSpec{
					{
						Port:     6791,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				},
				HealthCheck: &schema.HealthCheck{
					Type:                    utils.ToPtr(schema.HealthCheckTypeHTTP),
					Path:                    "/",
					Port:                    utils.ToPtr(int32(6791)),
					StartupPeriodSeconds:    utils.ToPtr(int32(5)),
					StartupTimeoutSeconds:   utils.ToPtr(int32(5)),
					StartupFailureThreshold: utils.ToPtr(int32(15)),
					HealthPeriodSeconds:     utils.ToPtr(int32(10)),
					HealthTimeoutSeconds:    utils.ToPtr(int32(5)),
					HealthFailureThreshold:  utils.ToPtr(int32(5)),
				},
				Variables: []schema.TemplateVariable{
					{
						Name: "NEXT_PUBLIC_DEPLOYMENT_URL",
						Generator: &schema.ValueGenerator{
							Type:      schema.GeneratorTypeInput,
							InputID:   "input_api_domain",
							AddPrefix: "https://",
						},
					},
				},
			},
		},
	}
}
