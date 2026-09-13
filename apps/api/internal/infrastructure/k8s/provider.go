package k8s

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	providerNginx   = "nginx"
	providerTraefik = "traefik"
	providerGateway = "gateway"
	providerAuto    = "auto"
)

// NetworkingCapabilities reports the exposure modes the active provider can deploy.
// TCP/UDP are universal (NodePort fallback); only TLS passthrough is gateway-only,
// so it is the capability that actually gates templates.
func (self *KubeClient) NetworkingCapabilities(ctx context.Context) []string {
	if self.NetworkingProvider(ctx) == providerGateway {
		return []string{"http", "grpc", "tcp", "udp", "tls"}
	}
	return []string{"http", "grpc", "tcp", "udp"}
}

var (
	gatewayClassGVR = schema.GroupVersionResource{Group: "gateway.networking.k8s.io", Version: "v1", Resource: "gatewayclasses"}
	httpRouteGVR    = schema.GroupVersionResource{Group: "gateway.networking.k8s.io", Version: "v1", Resource: "httproutes"}
	gatewayGVR      = schema.GroupVersionResource{Group: "gateway.networking.k8s.io", Version: "v1", Resource: "gateways"}
)

// NetworkingProvider resolves the active ingress/gateway controller. An explicit
// config value short-circuits; "auto" detects from the installed IngressClasses /
// GatewayClasses.
func (self *KubeClient) NetworkingProvider(ctx context.Context) string {
	requested := providerAuto
	if self.config != nil {
		if p := self.config.GetNetworkingProvider(); p != "" {
			requested = p
		}
	}
	if requested != providerAuto {
		return requested
	}
	return self.detectProvider(ctx)
}

// detectProvider asks the cluster which controller is installed. The answer only
// changes when one is installed or removed, so it is memoized rather than listed
// again on every call that needs to know how to expose a service.
func (self *KubeClient) detectProvider(ctx context.Context) string {
	provider, err := cached(ctx, self.clusterCache, "networking-provider",
		self.detectProviderUncached,
		func(p string) string { return p },
	)
	if err != nil {
		return providerNginx
	}
	return provider
}

func (self *KubeClient) detectProviderUncached(ctx context.Context) (string, error) {
	asked := false

	if self.client != nil {
		gcs, err := self.client.Resource(gatewayClassGVR).List(ctx, metav1.ListOptions{})
		if err == nil {
			asked = true
			if len(gcs.Items) > 0 {
				return providerGateway, nil
			}
		}
	}

	if self.clientset != nil {
		ics, err := self.clientset.NetworkingV1().IngressClasses().List(ctx, metav1.ListOptions{})
		if err == nil {
			asked = true
			for _, ic := range ics.Items {
				if ic.Name == providerTraefik {
					return providerTraefik, nil
				}
			}
		}
	}

	// An unreachable cluster is not an answer. Returning an error keeps the
	// fallback out of the cache, so a blip during startup can't pin the wrong
	// provider for the next five minutes.
	if !asked && (self.client != nil || self.clientset != nil) {
		return "", fmt.Errorf("could not reach the cluster to detect the networking provider")
	}

	// Conservative fallback: assume nginx when detection is inconclusive (no
	// GatewayClass and no traefik IngressClass). Keeps legacy clusters working;
	// fresh gateway installs set NETWORKING_PROVIDER explicitly.
	return providerNginx, nil
}
