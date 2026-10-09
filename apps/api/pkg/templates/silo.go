package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

func siloTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "Silo",
		DisplayRank: uint(60000),
		Icon:        "silo",
		Keywords:    []string{"object storage", "file storage", "s3", "s3 compatible", "minio", "r2", "aws", "cloudflare"},
		Description: "S3-compatible object storage, a maintained MinIO fork.",
		Version:     1,
		ResourceRecommendations: schema.TemplateResourceRecommendations{
			MinimumRecommendedCPU:   0.5,
			MinimumRecommendedRAMGB: 0.5,
		},
		Inputs: []schema.TemplateInput{
			{
				ID:          "input_domain_api",
				Name:        "API Domain",
				Type:        schema.InputTypeHost,
				Description: "The domain for the Silo API.",
				Required:    true,
				TargetPort:  new(9000),
			},
			{
				ID:          "input_domain_ui",
				Name:        "Dashboard Domain",
				Type:        schema.InputTypeHost,
				Description: "The domain for the Silo dashboard.",
				Required:    true,
				TargetPort:  new(9001),
			},
			{
				ID:   "input_storage_size",
				Name: "Storage Size",
				Type: schema.InputTypeVolumeSize,
				Volume: &schema.TemplateVolume{
					Name:      "silo-volume",
					MountPath: "/data",
				},
				Description: "Size of the storage for the Silo data.",
				Required:    true,
				Default:     new("1"),
			},
		},
		Services: []schema.TemplateService{
			{
				ID:       "service_silo",
				Name:     "Silo",
				Type:     schema.ServiceTypeDockerimage,
				Builder:  schema.ServiceBuilderDocker,
				InputIDs: []string{"input_domain_api", "input_domain_ui", "input_storage_size"},
				Image:    new("pgsty/silo:RELEASE.2026-09-16T00-00-00Z"),
				Resources: &schema.Resources{
					CPURequestsMillicores: 30,
				},
				Ports: []schema.PortSpec{
					{
						Port:     9000,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
					{
						Port:     9001,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				},
				RunCommand: new("silo server /data --console-address ':9001'"),
				HealthCheck: &schema.HealthCheck{
					Type:                    utils.ToPtr(schema.HealthCheckTypeExec),
					Command:                 "mc ready local",
					StartupPeriodSeconds:    new(int32(5)),
					StartupTimeoutSeconds:   new(int32(20)),
					StartupFailureThreshold: new(int32(10)),
					HealthPeriodSeconds:     new(int32(10)),
					HealthTimeoutSeconds:    new(int32(5)),
					HealthFailureThreshold:  new(int32(5)),
				},
				VariableDisplays: []schema.TemplateVariableDisplay{
					{Name: "MINIO_ROOT_USER", DisplayName: "Root User", Description: "Root user for the Silo console and API."},
					{Name: "MINIO_ROOT_PASSWORD", DisplayName: "Root Password", Description: "Root password for the Silo console and API."},
				},
				Variables: []schema.TemplateVariable{
					{
						Name:  "MINIO_ROOT_USER",
						Value: "minioadmin",
					},
					{
						Name: "MINIO_ROOT_PASSWORD",
						Generator: &schema.ValueGenerator{
							Type: schema.GeneratorTypePassword,
						},
					},
					{
						Name: "MINIO_SERVER_URL",
						Generator: &schema.ValueGenerator{
							Type:      schema.GeneratorTypeInput,
							InputID:   "input_domain_api",
							AddPrefix: "https://",
						},
					},
					{
						Name: "MINIO_BROWSER_REDIRECT_URL",
						Generator: &schema.ValueGenerator{
							Type:      schema.GeneratorTypeInput,
							InputID:   "input_domain_ui",
							AddPrefix: "https://",
						},
					},
					{
						Name:  "MINIO_BROWSER_REDIRECT",
						Value: "false",
					},
				},
			},
		},
	}
}
