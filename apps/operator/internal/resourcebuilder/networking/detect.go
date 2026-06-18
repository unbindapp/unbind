package networking

import (
	"context"
	"strings"

	networkingv1 "k8s.io/api/networking/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
	gwapiv1 "sigs.k8s.io/gateway-api/apis/v1"
)

// Resolve turns a requested provider into a concrete one, auto-detecting from the
// installed IngressClasses / GatewayClasses when requested is "auto", and fills in
// controller-specific Config (e.g. whether the gateway controller is Envoy).
func Resolve(ctx context.Context, c client.Reader, requested Provider, cfg Config) (Provider, Config) {
	provider := requested
	if provider == "" || provider == ProviderAuto {
		provider = detect(ctx, c)
	}
	if provider == ProviderGateway {
		cfg.GatewayControllerEnvoy = gatewayControllerIsEnvoy(ctx, c)
	}
	return provider, cfg
}

func detect(ctx context.Context, c client.Reader) Provider {
	gcList := &gwapiv1.GatewayClassList{}
	if err := c.List(ctx, gcList); err == nil && len(gcList.Items) > 0 {
		return ProviderGateway
	}

	icList := &networkingv1.IngressClassList{}
	if err := c.List(ctx, icList); err == nil {
		for _, ic := range icList.Items {
			if ic.Name == "traefik" {
				return ProviderTraefik
			}
		}
	}

	// Conservative fallback: when detection is inconclusive (no GatewayClass and
	// no traefik IngressClass, or RBAC/listing errors), assume nginx. This keeps
	// existing/legacy clusters working; fresh gateway installs pass the provider
	// explicitly via --networking-provider so they never rely on this.
	return ProviderNginx
}

func gatewayControllerIsEnvoy(ctx context.Context, c client.Reader) bool {
	gcList := &gwapiv1.GatewayClassList{}
	if err := c.List(ctx, gcList); err != nil {
		return false
	}
	for _, gc := range gcList.Items {
		if strings.Contains(string(gc.Spec.ControllerName), "envoyproxy") {
			return true
		}
	}
	return false
}
