package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// MeilisearchTemplate returns the predefined Meilisearch template
func meiliSearchTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "Meilisearch",
		DisplayRank: uint(80000),
		Icon:        "meilisearch",
		Keywords:    []string{"full text search", "elasticsearch", "search engine", "ram"},
		Description: "Fast & open source search engine.",
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
				Description: "The domain to use for the Meilisearch API.",
				Required:    true,
				TargetPort:  utils.ToPtr(7700),
			},
			{
				ID:   "input_storage_size",
				Name: "Storage Size",
				Type: schema.InputTypeVolumeSize,
				Volume: &schema.TemplateVolume{
					Name:      "meilisearch-data",
					MountPath: "/meili_data",
				},
				Description: "Size of the storage for the Meilisearch data.",
				Required:    true,
				Default:     utils.ToPtr("1"),
			},
		},
		Services: []schema.TemplateService{
			{
				ID:       "service_meilisearch",
				Name:     "Meilisearch",
				Type:     schema.ServiceTypeDockerimage,
				Builder:  schema.ServiceBuilderDocker,
				InputIDs: []string{"input_domain", "input_storage_size"},
				Image:    utils.ToPtr("getmeili/meilisearch:v1"),
				Resources: &schema.Resources{
					CPURequestsMillicores: 40,
					CPULimitsMillicores:   300,
				},
				Ports: []schema.PortSpec{
					{
						Port:     7700,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				},
				HealthCheck: &schema.HealthCheck{
					Type:                    utils.ToPtr(schema.HealthCheckTypeHTTP),
					Path:                    "/health",
					Port:                    utils.ToPtr(int32(7700)),
					StartupPeriodSeconds:    utils.ToPtr(int32(2)),
					StartupTimeoutSeconds:   utils.ToPtr(int32(10)),
					StartupFailureThreshold: utils.ToPtr(int32(15)),
					HealthPeriodSeconds:     utils.ToPtr(int32(10)),
					HealthTimeoutSeconds:    utils.ToPtr(int32(5)),
					HealthFailureThreshold:  utils.ToPtr(int32(5)),
				},
				Variables: []schema.TemplateVariable{
					{
						Name: "MEILI_MASTER_KEY",
						Generator: &schema.ValueGenerator{
							Type: schema.GeneratorTypePassword,
						},
					},
					{
						Name:  "MEILI_HTTP_ADDR",
						Value: "0.0.0.0:7700",
					},
					{
						Name:  "MEILI_ENV",
						Value: "production",
					},
				},
			},
		},
	}
}
