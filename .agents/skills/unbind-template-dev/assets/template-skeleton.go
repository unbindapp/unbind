package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// myAppTemplate is a starting skeleton: one database + one container image, wired by
// variable references, fronted by a domain and sized by user inputs.
//
// To ship it:
//  1. Rename the func + Name + Icon.
//  2. Register it in templater.go -> AvailableTemplates().
//  3. Add the "myapp" icon to apps/web/src/components/icons/brand.tsx.
//  4. cd apps/api && go build ./... && go test ./pkg/templates/
func myAppTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "MyApp",
		DisplayRank: uint(15000),
		Icon:        "myapp",
		Keywords:    []string{"myapp"},
		Description: "One blunt sentence describing MyApp.",
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
				Description: "The domain to use for MyApp.",
				Required:    true,
			},
			{
				ID:          "input_database_size",
				Name:        "Database Size",
				Type:        schema.InputTypeDatabaseSize,
				Description: "Size of the PostgreSQL database.",
				Required:    true,
				Default:     utils.ToPtr("1"),
			},
			{
				ID:   "input_storage_size",
				Name: "Storage Size",
				Type: schema.InputTypeVolumeSize,
				Volume: &schema.TemplateVolume{
					Name:      "myapp-data",
					MountPath: "/data",
				},
				Description: "Disk for MyApp uploads.",
				Required:    true,
				Default:     utils.ToPtr("1"),
			},
		},
		Services: []schema.TemplateService{
			{
				ID:           "service_db",
				Name:         "PostgreSQL",
				Type:         schema.ServiceTypeDatabase,
				Builder:      schema.ServiceBuilderDatabase,
				DatabaseType: utils.ToPtr("postgres"),
				InputIDs:     []string{"input_database_size"},
				DatabaseConfig: &schema.DatabaseConfig{
					DefaultDatabaseName: "myapp",
					Version:             "17",
				},
			},
			{
				ID:        "service_myapp",
				Name:      "MyApp",
				DependsOn: []string{"service_db"},
				Type:      schema.ServiceTypeDockerimage,
				Builder:   schema.ServiceBuilderDocker,
				Image:     utils.ToPtr("ghcr.io/org/myapp:v1.0.0"), // pin the tag
				InputIDs:  []string{"input_domain", "input_storage_size"},
				Resources: &schema.Resources{
					CPURequestsMillicores: 20,
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
					Path:                    "/health",
					Port:                    utils.ToPtr(int32(8080)),
					StartupPeriodSeconds:    utils.ToPtr(int32(5)),
					StartupTimeoutSeconds:   utils.ToPtr(int32(5)),
					StartupFailureThreshold: utils.ToPtr(int32(10)),
					HealthPeriodSeconds:     utils.ToPtr(int32(10)),
					HealthTimeoutSeconds:    utils.ToPtr(int32(5)),
					HealthFailureThreshold:  utils.ToPtr(int32(5)),
				},
				Variables: []schema.TemplateVariable{
					{
						Name:      "ADMIN_PASSWORD",
						Generator: &schema.ValueGenerator{Type: schema.GeneratorTypePassword},
					},
					{
						Name: "PUBLIC_URL",
						Generator: &schema.ValueGenerator{
							Type:      schema.GeneratorTypeInput,
							InputID:   "input_domain",
							AddPrefix: "https://",
						},
					},
				},
				VariableReferences: []schema.TemplateVariableReference{
					{SourceID: "service_db", SourceName: "DATABASE_USERNAME", TargetName: "MYAPP_DB_USER"},
					{SourceID: "service_db", SourceName: "DATABASE_PASSWORD", TargetName: "MYAPP_DB_PASSWORD"},
					{SourceID: "service_db", SourceName: "DATABASE_DEFAULT_DB_NAME", TargetName: "MYAPP_DB_NAME"},
					{SourceID: "service_db", SourceName: "DATABASE_HOST", TargetName: "MYAPP_DB_HOST"},
				},
			},
		},
	}
}
