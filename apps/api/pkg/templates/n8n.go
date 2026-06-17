package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// n8nTemplate returns the predefined n8n template with Redis queue mode and an external worker
func n8nTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "n8n",
		DisplayRank: uint(40000),
		Icon:        "n8n",
		Keywords:    []string{"workflow", "automation", "n8n", "queue", "low code", "low-code", "no code", "no-code", "chatbot", "ai", "llm"},
		Description: "Powerful AI workflow automation tools.",
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
				Description: "The domain to use for the n8n instance.",
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
			// PostgreSQL service (workflow metadata & credentials store)
			{
				ID:           "service_postgresql",
				Name:         "PostgreSQL",
				InputIDs:     []string{"input_database_size"},
				Type:         schema.ServiceTypeDatabase,
				Builder:      schema.ServiceBuilderDatabase,
				DatabaseType: utils.ToPtr("postgres"),
			},
			// Redis service (queue backend)
			{
				ID:           "service_redis",
				Name:         "Redis",
				Type:         schema.ServiceTypeDatabase,
				Builder:      schema.ServiceBuilderDatabase,
				DatabaseType: utils.ToPtr("redis"),
				DatabaseConfig: &schema.DatabaseConfig{
					StorageSize: "0.25",
				},
			},
			// External n8n worker (executes jobs from the queue)
			{
				ID:         "service_n8n_worker",
				DependsOn:  []string{"service_postgresql", "service_redis", "service_n8n"},
				Name:       "n8n Worker",
				Type:       schema.ServiceTypeDockerimage,
				Builder:    schema.ServiceBuilderDocker,
				Image:      utils.ToPtr("n8nio/n8n:1.102.0"),
				RunCommand: utils.ToPtr("n8n worker"),
				Resources: &schema.Resources{
					CPURequestsMillicores: 30,
					CPULimitsMillicores:   400,
				},
				Ports: []schema.PortSpec{
					{
						Port:     8000,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				},
				HealthCheck: &schema.HealthCheck{
					Type:                    utils.ToPtr(schema.HealthCheckTypeHTTP),
					Path:                    "/healthz/readiness",
					Port:                    utils.ToPtr(int32(8000)),
					StartupPeriodSeconds:    utils.ToPtr(int32(5)),
					StartupTimeoutSeconds:   utils.ToPtr(int32(5)),
					StartupFailureThreshold: utils.ToPtr(int32(30)),
					HealthPeriodSeconds:     utils.ToPtr(int32(10)),
					HealthTimeoutSeconds:    utils.ToPtr(int32(5)),
					HealthFailureThreshold:  utils.ToPtr(int32(5)),
				},
				Variables: []schema.TemplateVariable{
					// Queue mode for worker
					{
						Name:  "EXECUTIONS_MODE",
						Value: "queue",
					},
					{
						Name:  "N8N_WORKER_ID",
						Value: "worker-1",
					},
					{
						Name:  "QUEUE_HEALTH_CHECK_ACTIVE",
						Value: "true",
					},
					{
						Name:  "QUEUE_HEALTH_CHECK_PORT",
						Value: "8000",
					},
					{
						Name:  "N8N_RUNNERS_ENABLED",
						Value: "true",
					},
					{
						Name:  "OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS",
						Value: "true",
					},
					{
						Name:  "DB_TYPE",
						Value: "postgresdb",
					},
				},
				VariableReferences: []schema.TemplateVariableReference{
					// Postgres references (same as main)
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_DEFAULT_DB_NAME",
						TargetName: "DB_POSTGRESDB_DATABASE",
					},
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_HOST",
						TargetName: "DB_POSTGRESDB_HOST",
					},
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_PORT",
						TargetName: "DB_POSTGRESDB_PORT",
					},
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_USERNAME",
						TargetName: "DB_POSTGRESDB_USER",
					},
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_PASSWORD",
						TargetName: "DB_POSTGRESDB_PASSWORD",
					},
					// Redis references
					{
						SourceID:   "service_redis",
						SourceName: "DATABASE_HOST",
						TargetName: "QUEUE_BULL_REDIS_HOST",
					},
					{
						SourceID:   "service_redis",
						SourceName: "DATABASE_PORT",
						TargetName: "QUEUE_BULL_REDIS_PORT",
					},
					{
						SourceID:   "service_redis",
						SourceName: "DATABASE_PASSWORD",
						TargetName: "QUEUE_BULL_REDIS_PASSWORD",
					},
					// N8N references
					{
						SourceID:   "service_n8n",
						SourceName: "N8N_ENCRYPTION_KEY",
						TargetName: "N8N_ENCRYPTION_KEY",
					},
				},
			},
			// Main n8n process (API / UI)
			{
				ID:        "service_n8n",
				DependsOn: []string{"service_postgresql", "service_redis"},
				InputIDs:  []string{"input_domain"},
				Name:      "n8n",
				Type:      schema.ServiceTypeDockerimage,
				Builder:   schema.ServiceBuilderDocker,
				Image:     utils.ToPtr("n8nio/n8n:1.102.0"),
				Resources: &schema.Resources{
					CPURequestsMillicores: 40,
					CPULimitsMillicores:   400,
				},
				Ports: []schema.PortSpec{
					{
						Port:     5678,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				},
				HealthCheck: &schema.HealthCheck{
					Type:                    utils.ToPtr(schema.HealthCheckTypeHTTP),
					Path:                    "/healthz",
					Port:                    utils.ToPtr(int32(5678)),
					StartupPeriodSeconds:    utils.ToPtr(int32(5)),
					StartupTimeoutSeconds:   utils.ToPtr(int32(5)),
					StartupFailureThreshold: utils.ToPtr(int32(10)),
					HealthPeriodSeconds:     utils.ToPtr(int32(10)),
					HealthTimeoutSeconds:    utils.ToPtr(int32(5)),
					HealthFailureThreshold:  utils.ToPtr(int32(5)),
				},
				Variables: []schema.TemplateVariable{
					// Host related variables
					{
						Name: "N8N_HOST",
						Generator: &schema.ValueGenerator{
							Type:    schema.GeneratorTypeInput,
							InputID: "input_domain",
						},
					},
					{
						Name: "N8N_EDITOR_BASE_URL",
						Generator: &schema.ValueGenerator{
							Type:      schema.GeneratorTypeInput,
							InputID:   "input_domain",
							AddPrefix: "https://",
						},
					},
					{
						Name: "VUE_APP_URL_BASE_API",
						Generator: &schema.ValueGenerator{
							Type:      schema.GeneratorTypeInput,
							InputID:   "input_domain",
							AddPrefix: "https://",
						},
					},
					{
						Name: "WEBHOOK_TUNNEL_URL",
						Generator: &schema.ValueGenerator{
							Type:      schema.GeneratorTypeInput,
							InputID:   "input_domain",
							AddPrefix: "https://",
						},
					},
					// Core configuration
					{
						Name:  "N8N_PORT",
						Value: "5678",
					},
					{
						Name: "N8N_ENCRYPTION_KEY",
						Generator: &schema.ValueGenerator{
							Type:     schema.GeneratorTypePassword,
							HashType: utils.ToPtr(schema.ValueHashTypeSHA256),
						},
					},
					// Enable queue mode
					{
						Name:  "EXECUTIONS_MODE",
						Value: "queue",
					},
					// Route manual executions to workers as well (optional but recommended)
					{
						Name:  "OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS",
						Value: "true",
					},
					// Redis queue connection (host & port resolved via variable references below)
					{
						Name:  "QUEUE_BULL_REDIS_DB",
						Value: "0",
					},
					{
						Name:  "NODE_FUNCTION_ALLOW_EXTERNAL",
						Value: "axios,qs",
					},
					{
						Name:  "N8N_RUNNERS_ENABLED",
						Value: "true",
					},
					{
						Name:  "OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS",
						Value: "true",
					},
					{
						Name:  "DB_TYPE",
						Value: "postgresdb",
					},
				},
				VariableReferences: []schema.TemplateVariableReference{
					// Postgres references (same as the simple template)
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_DEFAULT_DB_NAME",
						TargetName: "DB_POSTGRESDB_DATABASE",
					},
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_HOST",
						TargetName: "DB_POSTGRESDB_HOST",
					},
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_PORT",
						TargetName: "DB_POSTGRESDB_PORT",
					},
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_USERNAME",
						TargetName: "DB_POSTGRESDB_USER",
					},
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_PASSWORD",
						TargetName: "DB_POSTGRESDB_PASSWORD",
					},
					// Redis references
					{
						SourceID:   "service_redis",
						SourceName: "DATABASE_HOST",
						TargetName: "QUEUE_BULL_REDIS_HOST",
					},
					{
						SourceID:   "service_redis",
						SourceName: "DATABASE_PORT",
						TargetName: "QUEUE_BULL_REDIS_PORT",
					},
					{
						SourceID:   "service_redis",
						SourceName: "DATABASE_PASSWORD",
						TargetName: "QUEUE_BULL_REDIS_PASSWORD",
					},
				},
			},
		},
	}
}
