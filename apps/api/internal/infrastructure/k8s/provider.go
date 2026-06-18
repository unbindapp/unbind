package k8s

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	providerNginx   = "nginx"
	providerTraefik = "traefik"
	providerGateway = "gateway"
	providerAuto    = "auto"
)

var (
	gatewayClassGVR = schema.GroupVersionResource{Group: "gateway.networking.k8s.io", Version: "v1", Resource: "gatewayclasses"}
	httpRouteGVR    = schema.GroupVersionResource{Group: "gateway.networking.k8s.io", Version: "v1", Resource: "httproutes"}
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

func (self *KubeClient) detectProvider(ctx context.Context) string {
	if self.client != nil {
		gcs, err := self.client.Resource(gatewayClassGVR).List(ctx, metav1.ListOptions{})
		if err == nil && len(gcs.Items) > 0 {
			return providerGateway
		}
	}
	if self.clientset != nil {
		ics, err := self.clientset.NetworkingV1().IngressClasses().List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, ic := range ics.Items {
				if ic.Name == providerTraefik {
					return providerTraefik
				}
			}
		}
	}
	// Conservative fallback: assume nginx when detection is inconclusive (no
	// GatewayClass and no traefik IngressClass, or listing errors). Keeps legacy
	// clusters working; fresh gateway installs set NETWORKING_PROVIDER explicitly.
	return providerNginx
}
