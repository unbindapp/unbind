package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// AppsmithTemplate returns the predefined Appsmith template
func appsmithTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "Appsmith",
		DisplayRank: uint(60400),
		Icon:        "appsmith",
		Keywords:    []string{"low code", "no code", "app builder", "internal tools", "dashboard", "automation"},
		Description: "Build admin panels, internal tools, and dashboards.",
		Version:     1,
		ResourceRecommendations: schema.TemplateResourceRecommendations{
			MinimumCPUs:  2,
			MinimumRAMGB: 4,
		},
		Inputs: []schema.TemplateInput{
			{
				ID:          "input_domain",
				Name:        "Domain",
				Type:        schema.InputTypeHost,
				Description: "The domain to use for the Appsmith instance.",
				Required:    true,
			},
			{
				ID:   "input_storage_size",
				Name: "Storage Size",
				Type: schema.InputTypeVolumeSize,
				Volume: &schema.TemplateVolume{
					Name:      "stacks-data",
					MountPath: "/appsmith-stacks",
				},
				Description: "Size of the storage for the Appsmith data.",
				Required:    true,
				Default:     utils.ToPtr("1"),
			},
		},
		Services: []schema.TemplateService{
			{
				ID:       "service_appsmith",
				InputIDs: []string{"input_domain", "input_storage_size"},
				Name:     "Appsmith",
				Type:     schema.ServiceTypeDockerimage,
				Builder:  schema.ServiceBuilderDocker,
				Image:    utils.ToPtr("appsmith/appsmith-ee:release"),
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
					Port:                    utils.ToPtr(int32(80)),
					StartupPeriodSeconds:    utils.ToPtr(int32(5)),
					StartupTimeoutSeconds:   utils.ToPtr(int32(20)),
					StartupFailureThreshold: utils.ToPtr(int32(10)),
					HealthPeriodSeconds:     utils.ToPtr(int32(10)),
					HealthTimeoutSeconds:    utils.ToPtr(int32(5)),
					HealthFailureThreshold:  utils.ToPtr(int32(5)),
				},
				Variables: []schema.TemplateVariable{
					{
						Name:  "APPSMITH_MAIL_ENABLED",
						Value: "false",
					},
					{
						Name:  "APPSMITH_DISABLE_TELEMETRY",
						Value: "false",
					},
					{
						Name:  "APPSMITH_DISABLE_INTERCOM",
						Value: "true",
					},
				},
			},
		},
	}
}
