package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// UmamiTemplate returns the predefined Umami Analytics template
func umamiTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "Umami",
		DisplayRank: uint(100000),
		Icon:        "umami",
		Keywords:    []string{"analytics", "open source", "privacy-friendly", "Google Analytics", "plausible"},
		Description: "Privacy-focused Google Analytics alternative.",
		Version:     1,
		ResourceRecommendations: schema.TemplateResourceRecommendations{
			MinimumCPUs:  1,
			MinimumRAMGB: 1,
		},
		Inputs: []schema.TemplateInput{
			{
				ID:          "input_domain",
				Name:        "Domain",
				Type:        schema.InputTypeHost,
				Description: "The domain to use for the Umami instance.",
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
				ID:        "service_umami",
				DependsOn: []string{"service_postgresql"},
				InputIDs:  []string{"input_domain"},
				Name:      "Umami",
				Type:      schema.ServiceTypeDockerimage,
				Builder:   schema.ServiceBuilderDocker,
				Image:     utils.ToPtr("ghcr.io/umami-software/umami:postgresql-v2"),
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
					Path:                    "/api/heartbeat",
					Port:                    utils.ToPtr(int32(3000)),
					StartupPeriodSeconds:    utils.ToPtr(int32(5)),
					StartupTimeoutSeconds:   utils.ToPtr(int32(20)),
					StartupFailureThreshold: utils.ToPtr(int32(10)),
					HealthPeriodSeconds:     utils.ToPtr(int32(10)),
					HealthTimeoutSeconds:    utils.ToPtr(int32(5)),
					HealthFailureThreshold:  utils.ToPtr(int32(5)),
				},
				Variables: []schema.TemplateVariable{
					{
						Name: "HASH_SALT",
						Generator: &schema.ValueGenerator{
							Type:     schema.GeneratorTypePassword,
							HashType: utils.ToPtr(schema.ValueHashTypeSHA512),
						},
					},
					{
						Name:  "DATABASE_TYPE",
						Value: "postgresql",
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
