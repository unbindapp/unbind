package networking

import (
	"fmt"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

type nginxProvider struct{}

func (nginxProvider) Name() Provider { return ProviderNginx }

func (nginxProvider) ServiceAnnotations(*v1.Service) map[string]string { return nil }

func (nginxProvider) BuildRoutes(in RouteInput) ([]client.Object, error) {
	if !needsRoutes(in.Service) {
		return nil, ErrRouteNotNeeded
	}
	ingress := buildIngress(in, "nginx", nginxAnnotations(in.Service.Name))
	return []client.Object{ingress}, nil
}

func nginxAnnotations(name string) map[string]string {
	return map[string]string{
		"kubernetes.io/tls-acme":                             "true",
		"nginx.ingress.kubernetes.io/eventsource":            "true",
		"nginx.ingress.kubernetes.io/add-base-url":           "true",
		"nginx.ingress.kubernetes.io/ssl-redirect":           "true",
		"nginx.ingress.kubernetes.io/websocket-services":     fmt.Sprintf("%s-service", name),
		"nginx.ingress.kubernetes.io/proxy-send-timeout":     "1800",
		"nginx.ingress.kubernetes.io/proxy-read-timeout":     "21600",
		"nginx.ingress.kubernetes.io/proxy-body-size":        "10m",
		"nginx.ingress.kubernetes.io/upstream-hash-by":       "$realip_remote_addr",
		"nginx.ingress.kubernetes.io/affinity":               "cookie",
		"nginx.ingress.kubernetes.io/session-cookie-name":    fmt.Sprintf("%s-session", name),
		"nginx.ingress.kubernetes.io/session-cookie-expires": "172800",
		"nginx.ingress.kubernetes.io/session-cookie-max-age": "172800",
	}
}
