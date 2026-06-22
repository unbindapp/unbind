package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// FlowiseTemplate returns the predefined Flowise template
func flowiseTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "Flowise",
		DisplayRank: uint(90000),
		Icon:        "flowise",
		Keywords:    []string{"llm", "ai", "chatbot", "langchain", "flow", "workflow", "automation", "low code", "low-code", "no code", "no-code", "chatbot", "ai"},
		Description: "Low code tool for building LLM flows.",
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
				Description: "The domain for the Flowise instance.",
				Required:    true,
			},
			{
				ID:   "input_storage_size",
				Name: "Storage Size",
				Type: schema.InputTypeVolumeSize,
				Volume: &schema.TemplateVolume{
					Name:      "flowise-data",
					MountPath: "/root/.flowise",
				},
				Description: "Size of the storage for the Flowise app data.",
				Required:    true,
				Default:     new("1"),
				Collapsed:   true,
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
				ID:         "service_flowise",
				DependsOn:  []string{"service_postgresql"},
				InputIDs:   []string{"input_domain", "input_storage_size"},
				Name:       "Flowise",
				Type:       schema.ServiceTypeDockerimage,
				Builder:    schema.ServiceBuilderDocker,
				Image:      new("flowiseai/flowise:3.1.2"),
				RunCommand: new("flowise start"),
				Resources: &schema.Resources{
					CPURequestsMillicores: 40,
					CPULimitsMillicores:   500,
				},
				Ports: []schema.PortSpec{
					{
						Port:     3000,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				},
				HealthCheck: &schema.HealthCheck{
					Type:                    utils.ToPtr(schema.HealthCheckTypeHTTP),
					Path:                    "/api/v1/ping",
					Port:                    new(int32(3000)),
					StartupPeriodSeconds:    new(int32(5)),
					StartupTimeoutSeconds:   new(int32(5)),
					StartupFailureThreshold: new(int32(10)),
					HealthPeriodSeconds:     new(int32(10)),
					HealthTimeoutSeconds:    new(int32(5)),
					HealthFailureThreshold:  new(int32(5)),
				},
				VariableDisplays: []schema.TemplateVariableDisplay{
					{Name: "FLOWISE_USERNAME", DisplayName: "Username", Description: "Username for the Flowise login."},
					{Name: "FLOWISE_PASSWORD", DisplayName: "Password", Description: "Password for the Flowise login."},
				},
				Variables: []schema.TemplateVariable{
					{
						Name:  "DEBUG",
						Value: "false",
					},
					{
						Name:  "PORT",
						Value: "3000",
					},
					{
						Name:  "FLOWISE_USERNAME",
						Value: "admin",
					},
					{
						Name: "FLOWISE_PASSWORD",
						Generator: &schema.ValueGenerator{
							Type: schema.GeneratorTypePassword,
						},
					},
					{
						Name:  "APIKEY_PATH",
						Value: "/root/.flowise",
					},
					{
						Name:  "SECRETKEY_PATH",
						Value: "/root/.flowise",
					},
					{
						Name:  "LOG_LEVEL",
						Value: "info",
					},
					{
						Name:  "LOG_PATH",
						Value: "/root/.flowise/logs",
					},
					{
						Name:  "DATABASE_TYPE",
						Value: "postgres",
					},
				},
				VariableReferences: []schema.TemplateVariableReference{
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_HOST",
						TargetName: "DATABASE_HOST",
					},
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_PORT",
						TargetName: "DATABASE_PORT",
					},
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_DEFAULT_DB_NAME",
						TargetName: "DATABASE_NAME",
					},
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_USERNAME",
						TargetName: "DATABASE_USER",
					},
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_PASSWORD",
						TargetName: "DATABASE_PASSWORD",
					},
				},
			},
		},
	}
}
