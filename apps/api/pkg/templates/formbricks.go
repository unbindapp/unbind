package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// formbricksTemplate returns the predefined Formbricks template
func formbricksTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "Formbricks",
		DisplayRank: uint(107500),
		Icon:        "formbricks",
		Keywords:    []string{"forms", "surveys", "feedback", "analytics", "open source", "typeform alternative"},
		Description: "Typeform alternative for user feedback and surveys.",
		Version:     3,
		ResourceRecommendations: schema.TemplateResourceRecommendations{
			MinimumRecommendedCPU:   1,
			MinimumRecommendedRAMGB: 2,
		},
		Inputs: []schema.TemplateInput{
			{
				ID:          "input_domain",
				Name:        "Domain",
				Type:        schema.InputTypeHost,
				Description: "The domain for the Formbricks instance.",
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
				ID:          "input_storage_size",
				Name:        "Storage Size",
				Type:        schema.InputTypeVolumeSize,
				Description: "Size of the storage for Formbricks uploads.",
				Required:    true,
				Default:     new("1"),
				Collapsed:   true,
				Volume: &schema.TemplateVolume{
					Name:      "formbricks-uploads",
					MountPath: "/home/nextjs/apps/web/uploads/",
				},
			},
		},
		Services: []schema.TemplateService{
			{
				ID:           "service_postgresql",
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
				ID:        "service_formbricks",
				Name:      "Formbricks",
				InputIDs:  []string{"input_domain", "input_storage_size"},
				Type:      schema.ServiceTypeDockerimage,
				Builder:   schema.ServiceBuilderDocker,
				Image:     new("ghcr.io/formbricks/formbricks:5.3.4"),
				DependsOn: []string{"service_postgresql", "service_redis"},
				Resources: &schema.Resources{
					CPURequestsMillicores: 30,
				},
				Ports: []schema.PortSpec{
					{
						Port:     3000,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				},
				HealthCheck: &schema.HealthCheck{
					Type:                    utils.ToPtr(schema.HealthCheckTypeHTTP),
					Path:                    "/health",
					Port:                    new(int32(3000)),
					StartupPeriodSeconds:    new(int32(10)),
					StartupTimeoutSeconds:   new(int32(20)),
					StartupFailureThreshold: new(int32(35)),
					HealthPeriodSeconds:     new(int32(10)),
					HealthTimeoutSeconds:    new(int32(10)),
					HealthFailureThreshold:  new(int32(5)),
				},
				Variables: []schema.TemplateVariable{
					{
						Name: "WEBAPP_URL",
						Generator: &schema.ValueGenerator{
							Type:      schema.GeneratorTypeInput,
							InputID:   "input_domain",
							AddPrefix: "https://",
						},
					},
					{
						Name: "NEXTAUTH_URL",
						Generator: &schema.ValueGenerator{
							Type:      schema.GeneratorTypeInput,
							InputID:   "input_domain",
							AddPrefix: "https://",
						},
					},
					{
						Name: "NEXTAUTH_SECRET",
						Generator: &schema.ValueGenerator{
							Type:     schema.GeneratorTypePassword,
							HashType: utils.ToPtr(schema.ValueHashTypeSHA256),
						},
					},
					{
						Name: "ENCRYPTION_KEY",
						Generator: &schema.ValueGenerator{
							Type:     schema.GeneratorTypePassword,
							HashType: utils.ToPtr(schema.ValueHashTypeSHA256),
						},
					},
					{
						Name: "CRON_SECRET",
						Generator: &schema.ValueGenerator{
							Type:     schema.GeneratorTypePassword,
							HashType: utils.ToPtr(schema.ValueHashTypeSHA256),
						},
					},
					{
						Name:  "EMAIL_VERIFICATION_DISABLED",
						Value: "1",
					},
					{
						Name:  "PASSWORD_RESET_DISABLED",
						Value: "1",
					},
					{
						Name:  "S3_FORCE_PATH_STYLE",
						Value: "0",
					},
					{
						Name:  "IS_FORMBRICKS_CLOUD",
						Value: "0",
					},
					{
						Name:  "NODE_ENV",
						Value: "production",
					},
					// Formbricks validates Cube and Hub settings at startup even though neither service ships here
					{
						Name:  "CUBEJS_API_URL",
						Value: "http://localhost:4000",
					},
					{
						Name: "CUBEJS_API_SECRET",
						Generator: &schema.ValueGenerator{
							Type: schema.GeneratorTypePassword,
						},
					},
					{
						Name:  "HUB_API_URL",
						Value: "http://localhost:8080",
					},
					{
						Name: "HUB_API_KEY",
						Generator: &schema.ValueGenerator{
							Type: schema.GeneratorTypePassword,
						},
					},
				},
				VariableReferences: []schema.TemplateVariableReference{
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_URL",
						TargetName: "DATABASE_URL",
					},
					{
						SourceID:   "service_redis",
						SourceName: "DATABASE_URL",
						TargetName: "REDIS_URL",
					},
				},
			},
		},
	}
}
