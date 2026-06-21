package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// WordPressTemplate returns the predefined WordPress template
func wordPressTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "WordPress",
		DisplayRank: uint(70000),
		Icon:        "wordpress",
		Keywords:    []string{"bloggin", "cms", "content management system", "WooCommerce", "ecommerce", "website", "publishing platform", "php", "mysql"},
		Description: "The open source publishing platform & CMS.",
		Version:     1,
		ResourceRecommendations: schema.TemplateResourceRecommendations{
			MinimumCPUs:  1,
			MinimumRAMGB: 0.5,
		},
		Inputs: []schema.TemplateInput{
			{
				ID:          "input_domain",
				Name:        "Domain",
				Type:        schema.InputTypeHost,
				Description: "The domain to use for the WordPress instance.",
				Required:    true,
			},
			{
				ID:          "input_database_size",
				Name:        "Database Size",
				Type:        schema.InputTypeDatabaseSize,
				Description: "Size of the storage for the MySQL database.",
				Required:    true,
				Default:     new("1"),
			},
		},
		Services: []schema.TemplateService{
			{
				ID:           "service_mysql",
				Name:         "MySQL",
				InputIDs:     []string{"input_database_size"},
				DisplayRank:  100,
				Type:         schema.ServiceTypeDatabase,
				Builder:      schema.ServiceBuilderDatabase,
				DatabaseType: new("mysql"),
			},
			{
				ID:        "service_wordpress",
				DependsOn: []string{"service_mysql"},
				InputIDs:  []string{"input_domain"},
				Name:      "WordPress",
				Type:      schema.ServiceTypeDockerimage,
				Builder:   schema.ServiceBuilderDocker,
				Image:     new("wordpress:7.0"),
				Resources: &schema.Resources{
					CPURequestsMillicores: 30,
					CPULimitsMillicores:   400,
				},
				Ports: []schema.PortSpec{
					{
						Port:     80,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				},
				HealthCheck: &schema.HealthCheck{
					Type:                    utils.ToPtr(schema.HealthCheckTypeHTTP),
					Path:                    "/",
					Port:                    new(int32(80)),
					StartupPeriodSeconds:    new(int32(3)),
					StartupTimeoutSeconds:   new(int32(10)),
					StartupFailureThreshold: new(int32(10)),
					HealthPeriodSeconds:     new(int32(10)),
					HealthTimeoutSeconds:    new(int32(5)),
					HealthFailureThreshold:  new(int32(5)),
				},
				VariableReferences: []schema.TemplateVariableReference{
					{
						SourceID:   "service_mysql",
						SourceName: "DATABASE_USERNAME",
						TargetName: "WORDPRESS_DB_USER",
					},
					{
						SourceID:   "service_mysql",
						SourceName: "DATABASE_PASSWORD",
						TargetName: "WORDPRESS_DB_PASSWORD",
					},
					{
						SourceID:   "service_mysql",
						SourceName: "DATABASE_DEFAULT_DB_NAME",
						TargetName: "WORDPRESS_DB_NAME",
					},
					{
						SourceID:   "service_mysql",
						SourceName: "DATABASE_HOST",
						TargetName: "WORDPRESS_DB_HOST",
					},
				},
			},
		},
	}
}
