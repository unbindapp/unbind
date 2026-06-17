package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// ListmonkTemplate returns the predefined Listmonk template
func listmonkTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "Listmonk",
		DisplayRank: uint(105000),
		Icon:        "listmonk",
		Keywords:    []string{"newsletter", "email", "mailing list", "campaign", "marketing", "smtp"},
		Description: "Newsletter and mailing list manager.",
		Version:     1,
		ResourceRecommendations: schema.TemplateResourceRecommendations{
			MinimumCPUs:  1,
			MinimumRAMGB: 0.25,
		},
		Inputs: []schema.TemplateInput{
			{
				ID:          "input_domain",
				Name:        "Domain",
				Type:        schema.InputTypeHost,
				Description: "The domain to use for the Listmonk instance.",
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
				ID:   "input_storage_size",
				Name: "Storage Size (Uploads)",
				Type: schema.InputTypeVolumeSize,
				Volume: &schema.TemplateVolume{
					Name:      "listmonk-uploads",
					MountPath: "/listmonk/uploads",
				},
				Description: "Size of the storage for the Listmonk uploads.",
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
				ID:         "service_listmonk",
				DependsOn:  []string{"service_postgresql"},
				InputIDs:   []string{"input_domain", "input_storage_size"},
				Name:       "Listmonk",
				Type:       schema.ServiceTypeDockerimage,
				Builder:    schema.ServiceBuilderDocker,
				Image:      utils.ToPtr("listmonk/listmonk:v5.0.2"),
				RunCommand: utils.ToPtr("./listmonk --install --idempotent --yes && ./listmonk --upgrade --yes && ./listmonk"),
				Resources: &schema.Resources{
					CPURequestsMillicores: 30,
					CPULimitsMillicores:   400,
				},
				Ports: []schema.PortSpec{
					{
						Port:     9000,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				},
				HealthCheck: &schema.HealthCheck{
					Type:                    utils.ToPtr(schema.HealthCheckTypeHTTP),
					Path:                    "/",
					Port:                    utils.ToPtr(int32(9000)),
					StartupPeriodSeconds:    utils.ToPtr(int32(5)),
					StartupTimeoutSeconds:   utils.ToPtr(int32(20)),
					StartupFailureThreshold: utils.ToPtr(int32(10)),
					HealthPeriodSeconds:     utils.ToPtr(int32(10)),
					HealthTimeoutSeconds:    utils.ToPtr(int32(5)),
					HealthFailureThreshold:  utils.ToPtr(int32(5)),
				},
				Variables: []schema.TemplateVariable{
					{
						Name:  "LISTMONK_app__address",
						Value: "0.0.0.0:9000",
					},
				},
				VariableReferences: []schema.TemplateVariableReference{
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_DEFAULT_DB_NAME",
						TargetName: "LISTMONK_db__database",
					},
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_USERNAME",
						TargetName: "LISTMONK_db__user",
					},
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_PASSWORD",
						TargetName: "LISTMONK_db__password",
					},
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_HOST",
						TargetName: "LISTMONK_db__host",
					},
					{
						SourceID:   "service_postgresql",
						SourceName: "DATABASE_PORT",
						TargetName: "LISTMONK_db__port",
					},
				},
			},
		},
	}
}
