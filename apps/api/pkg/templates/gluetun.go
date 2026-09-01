package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// GluetunTemplate returns the predefined Gluetun template
func gluetunTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "Gluetun",
		DisplayRank: uint(115000),
		Icon:        "gluetun",
		Keywords:    []string{"gluetun", "vpn", "proxy", "http proxy", "wireguard", "mullvad", "nordvpn", "protonvpn"},
		Description: "VPN client with a built-in HTTP proxy for routing other services' traffic.",
		Version:     1,
		ResourceRecommendations: schema.TemplateResourceRecommendations{
			MinimumCPUs:  1,
			MinimumRAMGB: 0.25,
		},
		Inputs: []schema.TemplateInput{
			{
				ID:          "input_vpn_provider",
				Name:        "VPN Provider",
				Type:        schema.InputTypeVariable,
				Description: `VPN service provider (e.g. "protonvpn").`,
				Required:    true,
			},
			{
				ID:          "input_wireguard_private_key",
				Name:        "WireGuard Private Key",
				Type:        schema.InputTypeVariable,
				Description: "WireGuard private key from your VPN provider.",
				Required:    true,
			},
			{
				ID:          "input_wireguard_addresses",
				Name:        "WireGuard Addresses",
				Type:        schema.InputTypeVariable,
				Description: `Tunnel IP(s) assigned by your provider (e.g. "10.0.0.1/32").`,
				Required:    true,
			},
			{
				ID:   "input_storage_size",
				Name: "Storage Size",
				Type: schema.InputTypeVolumeSize,
				Volume: &schema.TemplateVolume{
					Name:      "gluetun-volume",
					MountPath: "/gluetun",
				},
				Description: "Size of the storage for Gluetun server data.",
				Required:    true,
				Default:     new("1"),
			},
		},
		Services: []schema.TemplateService{
			{
				ID:      "service_gluetun",
				Name:    "Gluetun",
				Type:    schema.ServiceTypeDockerimage,
				Builder: schema.ServiceBuilderDocker,
				InputIDs: []string{
					"input_vpn_provider",
					"input_wireguard_private_key",
					"input_wireguard_addresses",
					"input_storage_size",
				},
				Image: new("qmcgaw/gluetun:v3.41.3"),
				Resources: &schema.Resources{
					CPURequestsMillicores:   50,
					CPULimitsMillicores:     1000,
					MemoryRequestsMegabytes: 50,
					MemoryLimitsMegabytes:   2000,
				},
				Ports: []schema.PortSpec{
					{
						Port:     8888,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
				},
				HealthCheck: &schema.HealthCheck{
					Type:                    utils.ToPtr(schema.HealthCheckTypeHTTP),
					Path:                    "/",
					Port:                    new(int32(9999)),
					StartupPeriodSeconds:    new(int32(5)),
					StartupTimeoutSeconds:   new(int32(5)),
					StartupFailureThreshold: new(int32(24)),
					HealthPeriodSeconds:     new(int32(10)),
					HealthTimeoutSeconds:    new(int32(5)),
					HealthFailureThreshold:  new(int32(6)),
				},
				VariableDisplays: []schema.TemplateVariableDisplay{
					{Name: "HTTPPROXY_USER", DisplayName: "Proxy Username", Description: "Username for the HTTP proxy."},
					{Name: "HTTPPROXY_PASSWORD", DisplayName: "Proxy Password", Description: "Password for the HTTP proxy."},
					{Name: "HTTP_PROXY_URL", DisplayName: "HTTP Proxy URL", Description: "Set this as HTTP_PROXY/HTTPS_PROXY on other services to route their traffic through the VPN."},
				},
				Variables: []schema.TemplateVariable{
					{
						Name: "VPN_SERVICE_PROVIDER",
						Generator: &schema.ValueGenerator{
							Type:    schema.GeneratorTypeInput,
							InputID: "input_vpn_provider",
						},
					},
					{
						Name:  "VPN_TYPE",
						Value: "wireguard",
					},
					{
						Name: "WIREGUARD_PRIVATE_KEY",
						Generator: &schema.ValueGenerator{
							Type:    schema.GeneratorTypeInput,
							InputID: "input_wireguard_private_key",
						},
					},
					{
						Name: "WIREGUARD_ADDRESSES",
						Generator: &schema.ValueGenerator{
							Type:    schema.GeneratorTypeInput,
							InputID: "input_wireguard_addresses",
						},
					},
					{
						Name:  "FIREWALL_OUTBOUND_SUBNETS",
						Value: "10.42.0.0/16,10.43.0.0/16",
					},
					{
						Name:  "HTTPPROXY",
						Value: "on",
					},
					{
						Name:  "HTTPPROXY_USER",
						Value: "gluetun",
					},
					{
						Name: "HTTPPROXY_PASSWORD",
						Generator: &schema.ValueGenerator{
							Type: schema.GeneratorTypePassword,
						},
					},
					{
						Name:  "HEALTH_SERVER_ADDRESS",
						Value: ":9999",
					},
					{
						Name:  "FIREWALL_INPUT_PORTS",
						Value: "8888,9999",
					},
					{
						Name:      "HTTP_PROXY_URL",
						Generator: &schema.ValueGenerator{Type: schema.GeneratorTypeStringReplace},
						Value:     "http://gluetun:${SERVICE_GLUETUN_HTTPPROXY_PASSWORD}@${SERVICE_GLUETUN_KUBE_NAME}.${NAMESPACE}:8888",
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
