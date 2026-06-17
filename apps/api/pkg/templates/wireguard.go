package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// WireGuardTemplate returns the predefined WireGuard template
func wireGuardTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "WireGuard",
		DisplayRank: uint(110000),
		Icon:        "wireguard",
		Keywords:    []string{"wireguard", "vpn", "tcp tunnel", "udp2raw", "openvpn"},
		Description: "Fast, modern, and open source VPN.",
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
				Description: "Hostname to use for the WireGuard instance.",
				Required:    true,
				TargetPort:  utils.ToPtr(51821), // Target TCP port
			},
			{
				ID:           "input_nodeport",
				Name:         "NodePort",
				Type:         schema.InputTypeGeneratedNodePort,
				PortProtocol: utils.ToPtr(schema.ProtocolUDP),
				Description:  "The NodePort to use for the WireGuard TCP tunnel.",
				Hidden:       true,
			},
			{
				ID:   "input_storage_size",
				Name: "Storage Size",
				Type: schema.InputTypeVolumeSize,
				Volume: &schema.TemplateVolume{
					Name:      "wireguard-config",
					MountPath: "/etc/wireguard",
				},
				Description: "Size of the storage for the WireGuard config data.",
				Required:    true,
				Default:     utils.ToPtr("1"),
			},
			{
				ID:          "input_node_ip",
				Name:        "Node IP",
				Type:        schema.InputTypeGeneratedNodeIP,
				Description: "IP address to connect to WireGuard, used to boostrap wg-easy UI",
				Hidden:      true,
			},
		},
		Services: []schema.TemplateService{
			// WireGuard Service
			{
				ID:       "service_wireguard",
				Name:     "WireGuard",
				Type:     schema.ServiceTypeDockerimage,
				Builder:  schema.ServiceBuilderDocker,
				InputIDs: []string{"input_domain", "input_nodeport", "input_storage_size"},
				Image:    utils.ToPtr("ghcr.io/wg-easy/wg-easy:15"),
				Resources: &schema.Resources{
					CPURequestsMillicores: 20,
					CPULimitsMillicores:   250,
				},
				Ports: []schema.PortSpec{
					{
						Port:     51821,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				},
				Variables: []schema.TemplateVariable{
					{
						Name:  "HOST",
						Value: "0.0.0.0",
					},
					{
						Name:  "PORT",
						Value: "51821",
					},
					{
						Name:  "INIT_ENABLED",
						Value: "true",
					},
					{
						Name: "INIT_HOST",
						Generator: &schema.ValueGenerator{
							Type:    schema.GeneratorTypeInput,
							InputID: "input_node_ip",
						},
					},
					{
						Name: "INIT_PORT",
						Generator: &schema.ValueGenerator{
							Type:    schema.GeneratorTypeInput,
							InputID: "input_nodeport",
						},
					},
					{
						Name:  "INIT_USERNAME",
						Value: "admin",
					},
					{
						Name: "INIT_PASSWORD",
						Generator: &schema.ValueGenerator{
							Type: schema.GeneratorTypePassword,
						},
					},
				},
				SecurityContext: &schema.SecurityContext{
					Capabilities: &schema.Capabilities{
						Add: []schema.Capability{
							"NET_ADMIN",
							"SYS_MODULE",
						},
					},
				},
			},
		},
	}
}
