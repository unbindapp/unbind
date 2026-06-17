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
		Version:     1,
		ResourceRecommendations: schema.TemplateResourceRecommendations{
			MinimumCPUs:  1,
			MinimumRAMGB: 2,
		},
		Inputs: []schema.TemplateInput{
			{
				ID:          "input_domain",
				Name:        "Domain",
				Type:        schema.InputTypeHost,
				Description: "The domain to use for the Formbricks instance.",
				Required:    true,
			},
			{
				ID:          "input_database_size",
				Name:        "Database Size",
				Type:        schema.InputTypeDatabaseSize,
				Description: "Size of the storage for the PostgreSQL database.",
				Required:    true,
				Default:     utils.ToPtr("1"),
			},
			{
				ID:          "input_storage_size",
				Name:        "Storage Size",
				Type:        schema.InputTypeVolumeSize,
				Description: "Size of the storage for Formbricks uploads.",
				Required:    true,
				Default:     utils.ToPtr("1"),
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
				Type:         schema.ServiceTypeDatabase,
				Builder:      schema.ServiceBuilderDatabase,
				DatabaseType: utils.ToPtr("postgres"),
			},
			{
				ID:        "service_formbricks",
				Name:      "Formbricks",
				InputIDs:  []string{"input_domain", "input_storage_size"},
				Type:      schema.ServiceTypeDockerimage,
				Builder:   schema.ServiceBuilderDocker,
				Image:     utils.ToPtr("ghcr.io/formbricks/formbricks:v3.15.0"),
				DependsOn: []string{"service_postgresql"},
				Resources: &schema.Resources{
					CPURequestsMillicores: 30,
					CPULimitsMillicores:   400,
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
					Port:                    utils.ToPtr(int32(3000)),
					StartupPeriodSeconds:    utils.ToPtr(int32(10)),
					StartupTimeoutSeconds:   utils.ToPtr(int32(20)),
					StartupFailureThreshold: utils.ToPtr(int32(35)),
					HealthPeriodSeconds:     utils.ToPtr(int32(10)),
					HealthTimeoutSeconds:    utils.ToPtr(int32(10)),
					HealthFailureThreshold:  utils.ToPtr(int32(5)),
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
				},
				VariableReferences: []schema.TemplateVariableReference{
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_URL",
						TargetName: "DATABASE_URL",
					},
				},
			},
		},
	}
}
