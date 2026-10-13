package networking

import (
	"fmt"
	"strings"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

type nginxProvider struct {
	cfg Config
}

func (nginxProvider) Name() Provider { return ProviderNginx }

func (nginxProvider) ServiceAnnotations(*v1.Service) map[string]string { return nil }

func (nginxProvider) ExposesL4ViaGateway() bool { return false }

func (p nginxProvider) BuildRoutes(in RouteInput) ([]client.Object, error) {
	svc := in.Service
	if !needsRoutes(svc) {
		return nil, ErrRouteNotNeeded
	}
	annotations := nginxAnnotations(svc)
	if hasGRPCHost(svc) {
		annotations["nginx.ingress.kubernetes.io/backend-protocol"] = "GRPC"
	}

	plain, optioned := splitHosts(svc)
	var objects []client.Object
	if len(plain) > 0 {
		objects = append(objects, buildIngress(in, svc.Name, "nginx", annotations, plain, tlsSecretName(svc)))
	}
	for _, i := range sortedIndexes(optioned) {
		host := optioned[i]
		name := hostIngressName(svc, i)
		hostAnnotations := nginxAnnotations(svc)
		if host.Protocol == "grpc" {
			hostAnnotations["nginx.ingress.kubernetes.io/backend-protocol"] = "GRPC"
		}
		if host.BasicAuth != nil {
			objects = append(objects, htpasswdSecret(svc, in.Labels, name, "auth", host.BasicAuth))
			hostAnnotations["nginx.ingress.kubernetes.io/auth-type"] = "basic"
			hostAnnotations["nginx.ingress.kubernetes.io/auth-secret"] = htpasswdSecretName(name)
			hostAnnotations["nginx.ingress.kubernetes.io/auth-secret-type"] = "auth-file"
		}
		if snippet := nginxSnippet(host); snippet != "" {
			hostAnnotations["nginx.ingress.kubernetes.io/configuration-snippet"] = snippet
		}
		objects = append(objects, buildIngress(in, name, "nginx", hostAnnotations, []v1.HostSpec{host}, name+"-tls-secret"))
	}
	return ingressRoutes(p.cfg, in, objects...), nil
}

// nginxSnippet carries what ingress-nginx has no annotation for: a redirect that
// keeps the request path, and response headers. The API keeps quotes, backslashes
// and dollar signs out of header values, so they land in the config verbatim.
func nginxSnippet(host v1.HostSpec) string {
	var lines []string
	for _, header := range host.ResponseHeaders {
		lines = append(lines, fmt.Sprintf("more_set_headers \"%s: %s\";", header.Name, header.Value))
	}
	if target, ok := parseRedirect(host.Redirect); ok {
		url := target.URL()
		if target.Path == "" {
			url += "$request_uri"
		}
		lines = append(lines, fmt.Sprintf("return %d %s;", host.Redirect.StatusCode, url))
	}
	return strings.Join(lines, "\n")
}

func hasGRPCHost(svc *v1.Service) bool {
	for _, h := range svc.Spec.Config.Hosts {
		if h.Protocol == "grpc" {
			return true
		}
	}
	return false
}

func nginxAnnotations(svc *v1.Service) map[string]string {
	annotations := map[string]string{
		"kubernetes.io/tls-acme":                         "true",
		"nginx.ingress.kubernetes.io/eventsource":        "true",
		"nginx.ingress.kubernetes.io/add-base-url":       "true",
		"nginx.ingress.kubernetes.io/ssl-redirect":       "true",
		"nginx.ingress.kubernetes.io/websocket-services": fmt.Sprintf("%s-service", svc.Name),
		"nginx.ingress.kubernetes.io/proxy-send-timeout": "1800",
		"nginx.ingress.kubernetes.io/proxy-read-timeout": "21600",
		"nginx.ingress.kubernetes.io/proxy-body-size":    fmt.Sprintf("%dm", maxRequestBodySizeMB(svc)),
	}
	if !svc.Spec.Config.SessionAffinity {
		return annotations
	}
	annotations["nginx.ingress.kubernetes.io/upstream-hash-by"] = "$realip_remote_addr"
	annotations["nginx.ingress.kubernetes.io/affinity"] = "cookie"
	annotations["nginx.ingress.kubernetes.io/session-cookie-name"] = fmt.Sprintf("%s-session", svc.Name)
	annotations["nginx.ingress.kubernetes.io/session-cookie-expires"] = "172800"
	annotations["nginx.ingress.kubernetes.io/session-cookie-max-age"] = "172800"
	return annotations
}
