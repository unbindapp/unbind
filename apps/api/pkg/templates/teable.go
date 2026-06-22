package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// teableTemplate returns the predefined Teable template
func teableTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "Teable",
		DisplayRank: uint(90500),
		Icon:        "teable",
		Keywords:    []string{"airtable", "teable", "no-code", "database", "visual", "interface", "relational", "sql", "postgresql"},
		Description: "The next-gen Airtable alternative.",
		Version:     2,
		ResourceRecommendations: schema.TemplateResourceRecommendations{
			MinimumCPUs:  1,
			MinimumRAMGB: 2,
		},
		Inputs: []schema.TemplateInput{
			{
				ID:          "input_domain",
				Name:        "Domain",
				Type:        schema.InputTypeHost,
				Description: "The domain to use for the Teable instance.",
				Required:    true,
			},
			{
				ID:          "input_database_size",
				Name:        "Database Size",
				Type:        schema.InputTypeDatabaseSize,
				Description: "Size of the storage for the PostgreSQL database.",
				Required:    true,
				Default:     new("1"),
				Collapsed:   true,
			},
			{
				ID:          "input_teable_size",
				Name:        "Storage Size",
				Type:        schema.InputTypeVolumeSize,
				Description: "Size of the storage for Teable assets.",
				Required:    true,
				Default:     new("1"),
				Collapsed:   true,
				Volume: &schema.TemplateVolume{
					Name:      "teable-data",
					MountPath: "/app/.assets",
				},
			},
		},
		Services: []schema.TemplateService{
			{
				ID:           "service_postgres",
				Name:         "PostgreSQL",
				InputIDs:     []string{"input_database_size"},
				DisplayRank:  100,
				Type:         schema.ServiceTypeDatabase,
				Builder:      schema.ServiceBuilderDatabase,
				DatabaseType: new("postgres"),
			},
			{
				ID:           "service_redis",
				Name:         "Redis",
				DisplayRank:  100,
				Type:         schema.ServiceTypeDatabase,
				Builder:      schema.ServiceBuilderDatabase,
				DatabaseType: new("redis"),
				DatabaseConfig: &schema.DatabaseConfig{
					StorageSize: "0.25",
				},
			},
			{
				ID:        "service_teable",
				Name:      "Teable",
				InputIDs:  []string{"input_domain", "input_teable_size"},
				Type:      schema.ServiceTypeDockerimage,
				Builder:   schema.ServiceBuilderDocker,
				Image:     new("ghcr.io/teableio/teable:release.2026-06-15T04-43-24Z.1912"),
				DependsOn: []string{"service_postgres", "service_redis"},
				Resources: &schema.Resources{
					CPURequestsMillicores: 40,
					CPULimitsMillicores:   400,
				},
				Ports: []schema.PortSpec{
					{
						Port:     3000,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				},
				Variables: []schema.TemplateVariable{
					{
						Name:  "BACKEND_CACHE_PROVIDER",
						Value: "redis",
					},
					{
						Name: "PUBLIC_ORIGIN",
						Generator: &schema.ValueGenerator{
							Type:      schema.GeneratorTypeInput,
							InputID:   "input_domain",
							AddPrefix: "https://",
						},
					},
					{
						Name: "SECRET_KEY",
						Generator: &schema.ValueGenerator{
							Type:     schema.GeneratorTypePassword,
							HashType: utils.ToPtr(schema.ValueHashTypeSHA256),
						},
					},
					{
						Name:  "PORT",
						Value: "3000",
					},
					{
						Name:  "NEXT_ENV_IMAGES_ALL_REMOTE",
						Value: "true",
					},
				},
				VariableReferences: []schema.TemplateVariableReference{
					{
						SourceID:   "service_redis",
						SourceName: "DATABASE_URL",
						TargetName: "BACKEND_CACHE_REDIS_URI",
					},
					{
						SourceID:   "service_postgres",
						SourceName: "DATABASE_URL",
						TargetName: "PRISMA_DATABASE_URL",
					},
				},
				HealthCheck: &schema.HealthCheck{
					Type:                    utils.ToPtr(schema.HealthCheckTypeHTTP),
					Path:                    "/health",
					Port:                    new(int32(3000)),
					StartupPeriodSeconds:    new(int32(5)),
					StartupTimeoutSeconds:   new(int32(20)),
					StartupFailureThreshold: new(int32(10)),
					HealthPeriodSeconds:     new(int32(10)),
					HealthTimeoutSeconds:    new(int32(5)),
					HealthFailureThreshold:  new(int32(5)),
				},
			},
		},
	}
}
