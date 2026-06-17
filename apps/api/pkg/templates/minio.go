package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// MinioTemplate returns the predefined MinIO template
func minioTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "MinIO",
		DisplayRank: uint(60000),
		Icon:        "minio",
		Keywords:    []string{"object storage", "file storage", "s3", "s3 compatible", "r2", "aws", "cloudflare"},
		Description: "S3-compatible object storage.",
		Version:     1,
		ResourceRecommendations: schema.TemplateResourceRecommendations{
			MinimumCPUs:  1,
			MinimumRAMGB: 1,
		},
		Inputs: []schema.TemplateInput{
			{
				ID:          "input_domain_api",
				Name:        "Domain (API)",
				Type:        schema.InputTypeHost,
				Description: "The domain to use for the MinIO API.",
				Required:    true,
				TargetPort:  utils.ToPtr(9000),
			},
			{
				ID:          "input_domain_ui",
				Name:        "Domain (UI)",
				Type:        schema.InputTypeHost,
				Description: "The domain to use for the MinIO UI.",
				Required:    true,
				TargetPort:  utils.ToPtr(9001),
			},
			{
				ID:   "input_storage_size",
				Name: "Storage Size",
				Type: schema.InputTypeVolumeSize,
				Volume: &schema.TemplateVolume{
					Name:      "minio-data",
					MountPath: "/data",
				},
				Description: "Size of the storage for the MinIO data.",
				Required:    true,
				Default:     utils.ToPtr("1"),
			},
		},
		Services: []schema.TemplateService{
			{
				ID:       "service_minio",
				Name:     "MinIO",
				Type:     schema.ServiceTypeDockerimage,
				Builder:  schema.ServiceBuilderDocker,
				InputIDs: []string{"input_domain_api", "input_domain_ui", "input_storage_size"},
				Image:    utils.ToPtr("minio/minio:latest"),
				Resources: &schema.Resources{
					CPURequestsMillicores: 30,
					CPULimitsMillicores:   400,
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
				RunCommand: utils.ToPtr("minio server /data --console-address ':9001'"),
				HealthCheck: &schema.HealthCheck{
					Type:                    utils.ToPtr(schema.HealthCheckTypeExec),
					Command:                 "mc ready local",
					StartupPeriodSeconds:    utils.ToPtr(int32(5)),
					StartupTimeoutSeconds:   utils.ToPtr(int32(20)),
					StartupFailureThreshold: utils.ToPtr(int32(10)),
					HealthPeriodSeconds:     utils.ToPtr(int32(10)),
					HealthTimeoutSeconds:    utils.ToPtr(int32(5)),
					HealthFailureThreshold:  utils.ToPtr(int32(5)),
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
