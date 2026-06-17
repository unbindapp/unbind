package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// GhostTemplate returns the predefined Ghost template
func ghostTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "Ghost",
		DisplayRank: uint(30000),
		Icon:        "ghost",
		Keywords:    []string{"blogging", "cms", "mysql"},
		Description: "Open source blog and newsletter platform.",
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
				Description: "The domain to use for the Ghost instance.",
				Required:    true,
			},
			{
				ID:          "input_database_size",
				Name:        "Database Size",
				Type:        schema.InputTypeDatabaseSize,
				Description: "Size of the storage for the MySQL database.",
				Required:    true,
				Default:     utils.ToPtr("1"),
			},
		},
		Services: []schema.TemplateService{
			{
				ID:           "service_mysql",
				Name:         "MySQL",
				InputIDs:     []string{"input_database_size"},
				Type:         schema.ServiceTypeDatabase,
				Builder:      schema.ServiceBuilderDatabase,
				DatabaseType: utils.ToPtr("mysql"),
			},
			{
				ID:        "service_ghost",
				DependsOn: []string{"service_mysql"},
				InputIDs:  []string{"input_domain"},
				Name:      "Ghost",
				Type:      schema.ServiceTypeDockerimage,
				Builder:   schema.ServiceBuilderDocker,
				Image:     utils.ToPtr("ghost:5"),
				Resources: &schema.Resources{
					CPURequestsMillicores: 30,
					CPULimitsMillicores:   400,
				},
				Ports: []schema.PortSpec{
					{
						Port:     2368,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				},
				// ! Ghost doesn't have a good health check endpoint?
				Variables: []schema.TemplateVariable{
					{
						Name: "url",
						Generator: &schema.ValueGenerator{
							Type:      schema.GeneratorTypeInput,
							InputID:   "input_domain",
							AddPrefix: "https://",
						},
					},
					{
						Name:  "database__client",
						Value: "mysql",
					},
				},
				VariableReferences: []schema.TemplateVariableReference{
					{
						SourceID:   "service_mysql",
						SourceName: "DATABASE_USERNAME",
						TargetName: "database__connection__user",
					},
					{
						SourceID:   "service_mysql",
						SourceName: "DATABASE_PASSWORD",
						TargetName: "database__connection__password",
					},
					{
						SourceID:   "service_mysql",
						SourceName: "DATABASE_DEFAULT_DB_NAME",
						TargetName: "database__connection__database",
					},
					{
						SourceID:   "service_mysql",
						SourceName: "DATABASE_HOST",
						TargetName: "database__connection__host",
					},
				},
			},
		},
	}
}
