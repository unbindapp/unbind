package networking

import (
	"fmt"
	"strings"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

type Provider string

const (
	ProviderNginx   Provider = "nginx"
	ProviderTraefik Provider = "traefik"
	ProviderGateway Provider = "gateway"
	ProviderAuto    Provider = "auto"
)

// Capability is an exposure mode a provider can realize.
type Capability string

const (
	CapHTTP Capability = "http"
	CapGRPC Capability = "grpc"
	CapTCP  Capability = "tcp"
	CapUDP  Capability = "udp"
	CapTLS  Capability = "tls" // TLS passthrough (SNI routing); no NodePort fallback
)

// Capabilities reports the exposure modes a provider can deploy. TCP/UDP are
// listed for all providers because NodePort is a universal L4 fallback; only TLS
// passthrough is gateway-exclusive, so it is the one that actually gates features.
func Capabilities(p Provider) []Capability {
	switch p {
	case ProviderGateway:
		return []Capability{CapHTTP, CapGRPC, CapTCP, CapUDP, CapTLS}
	default:
		return []Capability{CapHTTP, CapGRPC, CapTCP, CapUDP}
	}
}

// ErrRouteNotNeeded signals that a service exposes no public hosts/ports and
// therefore needs no external routing resources.
var ErrRouteNotNeeded = fmt.Errorf("route not needed, probably no domain configured")

// Config carries cluster-wide routing settings resolved once at startup.
type Config struct {
	// GatewayClassName is the GatewayClass the per-service Gateways attach to.
	GatewayClassName string
	// ClusterIssuer is the cert-manager ClusterIssuer that issues per-host certs
	// for service Gateways (via the gateway-shim, over HTTP-01).
	ClusterIssuer string
	// GatewayControllerEnvoy enables Envoy Gateway policy CRDs for features
	// (cookie session affinity) that have no portable HTTPRoute equivalent.
	GatewayControllerEnvoy bool
}

// RouteInput is the per-service data a provider needs to build routing objects.
type RouteInput struct {
	Service *v1.Service
	Labels  map[string]string
}

// NetworkingProvider builds the controller-specific routing objects for a service.
type NetworkingProvider interface {
	Name() Provider
	BuildRoutes(in RouteInput) ([]client.Object, error)
	// ServiceAnnotations are merged onto the backing ClusterIP Service, used by
	// controllers (Traefik) that read routing config from the Service.
	ServiceAnnotations(svc *v1.Service) map[string]string
	// ExposesL4ViaGateway reports whether external TCP/UDP ports are realized as
	// Gateway L4 routes (true) or NodePort Services (false). When true the backing
	// Service stays ClusterIP and the provider emits TCP/UDPRoutes.
	ExposesL4ViaGateway() bool
}

// externalL4Ports returns the ports flagged for external L4 exposure (NodePort set).
func externalL4Ports(svc *v1.Service) []v1.PortSpec {
	var ports []v1.PortSpec
	for _, p := range svc.Spec.Config.Ports {
		if p.NodePort != nil {
			ports = append(ports, p)
		}
	}
	return ports
}

func portProtocol(p v1.PortSpec) string {
	if p.Protocol != nil && string(*p.Protocol) == "UDP" {
		return "UDP"
	}
	return "TCP"
}

func New(provider Provider, cfg Config) NetworkingProvider {
	switch provider {
	case ProviderTraefik:
		return &traefikProvider{}
	case ProviderGateway:
		return &gatewayProvider{cfg: cfg}
	default:
		return &nginxProvider{}
	}
}

// RouteGVKs enumerates every kind any provider may emit, used to garbage collect
// stale routing objects when the active provider changes.
func RouteGVKs() []schema.GroupVersionKind {
	return []schema.GroupVersionKind{
		{Group: "networking.k8s.io", Version: "v1", Kind: "Ingress"},
		{Group: "gateway.networking.k8s.io", Version: "v1", Kind: "HTTPRoute"},
		{Group: "gateway.networking.k8s.io", Version: "v1", Kind: "GRPCRoute"},
		{Group: "gateway.networking.k8s.io", Version: "v1alpha2", Kind: "TCPRoute"},
		{Group: "gateway.networking.k8s.io", Version: "v1alpha2", Kind: "UDPRoute"},
		{Group: "gateway.networking.k8s.io", Version: "v1", Kind: "Gateway"},
		{Group: "traefik.io", Version: "v1alpha1", Kind: "Middleware"},
		{Group: "gateway.envoyproxy.io", Version: "v1alpha1", Kind: "BackendTrafficPolicy"},
	}
}

func needsRoutes(svc *v1.Service) bool {
	return len(svc.Spec.Config.Hosts) >= 1 && len(svc.Spec.Config.Ports) >= 1 && svc.Spec.Config.Public
}

func resolveHostPort(svc *v1.Service, host v1.HostSpec) (int32, string) {
	port := svc.Spec.Config.Ports[0].Port
	if host.Port != nil {
		port = *host.Port
	}
	path := "/"
	if host.Path != "" {
		path = host.Path
	}
	return port, path
}

func tlsSecretName(svc *v1.Service) string {
	return fmt.Sprintf("%s-tls-secret", strings.ToLower(svc.Name))
}
