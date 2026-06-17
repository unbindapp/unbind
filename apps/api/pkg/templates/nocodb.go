package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// nocodbTemplate returns the predefined NocoDB template
func nocodbTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "NocoDB",
		DisplayRank: uint(60200),
		Icon:        "nocodb",
		Keywords:    []string{"low code", "no code", "no-code", "database", "spreadsheet", "airtable alternative", "api builder", "sql", "postgresql"},
		Description: "Build databases as spreadsheets.",
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
				Description: "The domain to use for the NocoDB instance.",
				Required:    true,
				TargetPort:  utils.ToPtr(8080),
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
				ID:   "input_storage_size",
				Name: "Storage Size",
				Type: schema.InputTypeVolumeSize,
				Volume: &schema.TemplateVolume{
					Name:      "nocodb-data",
					MountPath: "/usr/app/data/",
				},
				Description: "Size of the storage for NocoDB data.",
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
				ID:        "service_nocodb",
				InputIDs:  []string{"input_domain", "input_storage_size"},
				Name:      "NocoDB",
				Type:      schema.ServiceTypeDockerimage,
				Builder:   schema.ServiceBuilderDocker,
				Image:     utils.ToPtr("nocodb/nocodb:latest"),
				DependsOn: []string{"service_postgresql"},
				Resources: &schema.Resources{
					CPURequestsMillicores: 40,
					CPULimitsMillicores:   400,
				},
				Ports: []schema.PortSpec{
					{
						Port:     8080,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				},
				HealthCheck: &schema.HealthCheck{
					Type:                    utils.ToPtr(schema.HealthCheckTypeHTTP),
					Path:                    "/api/v1/health",
					Port:                    utils.ToPtr(int32(8080)),
					StartupPeriodSeconds:    utils.ToPtr(int32(5)),
					StartupTimeoutSeconds:   utils.ToPtr(int32(20)),
					StartupFailureThreshold: utils.ToPtr(int32(10)),
					HealthPeriodSeconds:     utils.ToPtr(int32(10)),
					HealthTimeoutSeconds:    utils.ToPtr(int32(5)),
					HealthFailureThreshold:  utils.ToPtr(int32(5)),
				},
				VariableReferences: []schema.TemplateVariableReference{
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_HOST",
						AdditionalTemplateSources: []string{
							"DATABASE_PORT",
							"DATABASE_USERNAME",
							"DATABASE_PASSWORD",
							"DATABASE_DEFAULT_DB_NAME",
						},
						TargetName:     "NC_DB",
						TemplateString: "pg://${DATABASE_HOST}:${DATABASE_PORT}?u=${DATABASE_USERNAME}&p=${DATABASE_PASSWORD}&d=${DATABASE_DEFAULT_DB_NAME}",
					},
				},
				Variables: []schema.TemplateVariable{
					{
						Name: "NC_AUTH_JWT_SECRET",
						Generator: &schema.ValueGenerator{
							Type:     schema.GeneratorTypePassword,
							HashType: utils.ToPtr(schema.ValueHashTypeSHA256),
						},
					},
					{
						Name: "NC_PUBLIC_URL",
						Generator: &schema.ValueGenerator{
							Type:      schema.GeneratorTypeInput,
							InputID:   "input_domain",
							AddPrefix: "https://",
						},
					},
				},
			},
		},
	}
}
