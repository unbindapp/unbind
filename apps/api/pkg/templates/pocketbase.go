package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// PocketBaseTemplate returns the predefined PocketBase template
func pocketBaseTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "PocketBase",
		DisplayRank: uint(20000),
		Icon:        "pocketbase",
		Keywords:    []string{"pocketbase", "database", "backend", "supabase", "firebase"},
		Description: "Open source backend in 1 file.",
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
				Description: "The domain to use for the PocketBase instance.",
				Required:    true,
			},
			{
				ID:   "input_storage_size",
				Name: "Storage Size",
				Type: schema.InputTypeVolumeSize,
				Volume: &schema.TemplateVolume{
					Name:      "pb-data",
					MountPath: "/pb_data",
				},
				Description: "Size of the storage for the PocketBase data.",
				Required:    true,
				Default:     new("1"),
			},
		},
		Services: []schema.TemplateService{
			{
				ID:       "service_pocketbase",
				Name:     "PocketBase",
				Type:     schema.ServiceTypeDockerimage,
				Builder:  schema.ServiceBuilderDocker,
				InputIDs: []string{"input_domain", "input_storage_size"},
				Image:    new("ghcr.io/unbindapp/pocketbase:v0.39.4"),
				Resources: &schema.Resources{
					CPURequestsMillicores: 20,
					CPULimitsMillicores:   400,
				},
				Ports: []schema.PortSpec{
					{
						Port:     8090,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				},
				HealthCheck: &schema.HealthCheck{
					Type:                    utils.ToPtr(schema.HealthCheckTypeHTTP),
					Path:                    "/api/health",
					Port:                    new(int32(8090)),
					StartupPeriodSeconds:    new(int32(5)),
					StartupTimeoutSeconds:   new(int32(5)),
					StartupFailureThreshold: new(int32(10)),
					HealthPeriodSeconds:     new(int32(10)),
					HealthTimeoutSeconds:    new(int32(5)),
					HealthFailureThreshold:  new(int32(5)),
				},
				VariableDisplays: []schema.TemplateVariableDisplay{
					{Name: "PB_ADMIN_EMAIL", DisplayName: "Admin Email", Description: "Email for the PocketBase admin login."},
					{Name: "PB_ADMIN_PASSWORD", DisplayName: "Admin Password", Description: "Password for the PocketBase admin login."},
				},
				Variables: []schema.TemplateVariable{
					{
						Name: "PB_ADMIN_EMAIL",
						Generator: &schema.ValueGenerator{
							Type: schema.GeneratorTypeEmail,
						},
					},
					{
						Name: "PB_ADMIN_PASSWORD",
						Generator: &schema.ValueGenerator{
							Type: schema.GeneratorTypePassword,
						},
					},
				},
			},
		},
	}
}
