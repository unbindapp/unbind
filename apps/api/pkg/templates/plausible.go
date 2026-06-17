package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// PlausibleTemplate returns the predefined Plausible Analytics template
func plausibleTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "Plausible",
		DisplayRank: uint(10000),
		Icon:        "plausible",
		Keywords:    []string{"analytics", "privacy-friendly", "open source", "Google Analytics", "umami"},
		Description: "Privacy-friendly Google Analytics alternative.",
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
				Description: "The domain to use for the Plausible instance.",
				Required:    true,
			},
			{
				ID:          "input_postgresql_size",
				Name:        "PostgreSQL Size",
				Type:        schema.InputTypeDatabaseSize,
				Description: "Size of the storage for the PostgreSQL database.",
				Required:    true,
				Default:     utils.ToPtr("1"),
			},
			{
				ID:          "input_clickhouse_size",
				Name:        "Clickhouse Size",
				Type:        schema.InputTypeDatabaseSize,
				Description: "Size of the storage for the Clickhouse database.",
				Required:    true,
				Default:     utils.ToPtr("1"),
			},
		},
		Services: []schema.TemplateService{
			{
				ID:           "service_postgresql",
				Name:         "PostgreSQL",
				InputIDs:     []string{"input_postgresql_size"},
				Type:         schema.ServiceTypeDatabase,
				Builder:      schema.ServiceBuilderDatabase,
				DatabaseType: utils.ToPtr("postgres"),
			},
			{
				ID:           "service_clickhouse",
				Name:         "ClickHouse",
				InputIDs:     []string{"input_clickhouse_size"},
				Type:         schema.ServiceTypeDatabase,
				Builder:      schema.ServiceBuilderDatabase,
				DatabaseType: utils.ToPtr("clickhouse"),
			},
			{
				ID:         "service_plausible",
				DependsOn:  []string{"service_postgresql", "service_clickhouse"},
				InputIDs:   []string{"input_domain"},
				Name:       "Plausible",
				RunCommand: utils.ToPtr("sh -c \"/entrypoint.sh db createdb && /entrypoint.sh db migrate && /entrypoint.sh run\""),
				Type:       schema.ServiceTypeDockerimage,
				Builder:    schema.ServiceBuilderDocker,
				Image:      utils.ToPtr("ghcr.io/plausible/community-edition:v3"),
				Resources: &schema.Resources{
					CPURequestsMillicores: 30,
					CPULimitsMillicores:   500,
				},
				Ports: []schema.PortSpec{
					{
						Port:     8000,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				},
				HealthCheck: &schema.HealthCheck{
					Type:                    utils.ToPtr(schema.HealthCheckTypeHTTP),
					Path:                    "/api/health",
					Port:                    utils.ToPtr(int32(8000)),
					StartupPeriodSeconds:    utils.ToPtr(int32(10)),
					StartupTimeoutSeconds:   utils.ToPtr(int32(10)),
					StartupFailureThreshold: utils.ToPtr(int32(20)),
					HealthPeriodSeconds:     utils.ToPtr(int32(10)),
					HealthTimeoutSeconds:    utils.ToPtr(int32(5)),
					HealthFailureThreshold:  utils.ToPtr(int32(5)),
				},
				Variables: []schema.TemplateVariable{
					{
						Name:  "HTTP_PORT",
						Value: "8000",
					},
					{
						Name: "BASE_URL",
						Generator: &schema.ValueGenerator{
							Type:      schema.GeneratorTypeInput,
							InputID:   "input_domain",
							AddPrefix: "https://",
						},
					},
					{
						Name: "SECRET_KEY_BASE",
						Generator: &schema.ValueGenerator{
							Type: schema.GeneratorTypePassword,
							// Plausible wants a 64-byte key
							HashType: utils.ToPtr(schema.ValueHashTypeSHA512),
						},
					},
				},
				VariableReferences: []schema.TemplateVariableReference{
					// PostgreSQL references
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_URL",
						TargetName: "DATABASE_URL",
					},
					// ClickHouse references
					{
						SourceID:   "service_clickhouse",
						SourceName: "DATABASE_HTTP_URL",
						TargetName: "CLICKHOUSE_DATABASE_URL",
					},
				},
			},
		},
	}
}
