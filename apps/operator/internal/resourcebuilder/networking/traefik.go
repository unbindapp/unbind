package networking

import (
	"fmt"
	"strings"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

type traefikProvider struct {
	cfg Config
}

func (traefikProvider) Name() Provider { return ProviderTraefik }

func (traefikProvider) ServiceAnnotations(svc *v1.Service) map[string]string {
	annotations := map[string]string{}
	if svc.Spec.Config.SessionAffinity {
		annotations["traefik.ingress.kubernetes.io/service.sticky.cookie"] = "true"
		annotations["traefik.ingress.kubernetes.io/service.sticky.cookie.name"] = fmt.Sprintf("%s-session", svc.Name)
		annotations["traefik.ingress.kubernetes.io/service.sticky.cookie.maxage"] = "172800"
	}
	if hasGRPCHost(svc) {
		annotations["traefik.ingress.kubernetes.io/service.serversscheme"] = "h2c"
	}
	return annotations
}

func (traefikProvider) ExposesL4ViaGateway() bool { return false }

func (p traefikProvider) BuildRoutes(in RouteInput) ([]client.Object, error) {
	svc := in.Service
	if !needsRoutes(svc) {
		return nil, ErrRouteNotNeeded
	}

	redirect := traefikMiddleware(svc.Name+"-redirect", svc.Namespace, in.Labels, map[string]any{
		"redirectScheme": map[string]any{"scheme": "https", "permanent": true},
	})
	buffering := traefikMiddleware(svc.Name+"-buffering", svc.Namespace, in.Labels, map[string]any{
		"buffering": map[string]any{"maxRequestBodyBytes": maxRequestBodySizeMB(svc) << 20},
	})
	var objects []client.Object

	plain, optioned := splitHosts(svc)
	if len(plain) > 0 {
		annotations := traefikAnnotations(svc.Namespace, redirect, buffering)
		objects = append(objects, buildIngress(in, svc.Name, "traefik", annotations, plain, tlsSecretName(svc)))
	}
	objects = append(objects, redirect, buffering)
	for _, host := range optioned {
		name := hostObjectName(svc, host)
		middlewares := []*unstructured.Unstructured{redirect, buffering}
		if target, ok := parseRedirect(host.Redirect); ok {
			middlewares = append(middlewares, traefikMiddleware(name+"-redirect", svc.Namespace, in.Labels, traefikRedirect(target, host.Redirect.StatusCode)))
		}
		if host.BasicAuth != nil {
			objects = append(objects, htpasswdSecret(svc, in.Labels, name, "users", host.BasicAuth))
			middlewares = append(middlewares, traefikMiddleware(name+"-auth", svc.Namespace, in.Labels, map[string]any{
				"basicAuth": map[string]any{"secret": htpasswdSecretName(name)},
			}))
		}
		if len(host.ResponseHeaders) > 0 {
			headers := map[string]any{}
			for _, header := range host.ResponseHeaders {
				headers[header.Name] = header.Value
			}
			middlewares = append(middlewares, traefikMiddleware(name+"-headers", svc.Namespace, in.Labels, map[string]any{
				"headers": map[string]any{"customResponseHeaders": headers},
			}))
		}
		annotations := traefikAnnotations(svc.Namespace, middlewares...)
		objects = append(objects, buildIngress(in, name, "traefik", annotations, []v1.HostSpec{host}, name+"-tls-secret"))
		for _, mw := range middlewares[2:] {
			objects = append(objects, mw)
		}
	}

	return ingressRoutes(p.cfg, in, objects...), nil
}

func traefikAnnotations(namespace string, middlewares ...*unstructured.Unstructured) map[string]string {
	return map[string]string{
		"kubernetes.io/tls-acme":                           "true",
		"traefik.ingress.kubernetes.io/router.entrypoints": "websecure",
		"traefik.ingress.kubernetes.io/router.middlewares": traefikMiddlewareRefs(namespace, middlewares...),
	}
}

// traefikRedirect rewrites the whole request URL. Traefik picks 301/302 for GET and
// 308/307 for other methods from the permanent flag, so 308 maps to permanent.
func traefikRedirect(target urlTarget, statusCode int32) map[string]any {
	regex, replacement := "^.*$", target.URL()
	if target.Path == "" {
		regex, replacement = "^https?://[^/]+(.*)$", target.URL()+"${1}"
	}
	return map[string]any{
		"redirectRegex": map[string]any{
			"regex":       regex,
			"replacement": replacement,
			"permanent":   statusCode == 301 || statusCode == 308,
		},
	}
}

func traefikMiddleware(name, namespace string, labels map[string]string, spec map[string]any) *unstructured.Unstructured {
	u := &unstructured.Unstructured{}
	u.SetGroupVersionKind(schema.GroupVersionKind{Group: "traefik.io", Version: "v1alpha1", Kind: "Middleware"})
	u.SetName(name)
	u.SetNamespace(namespace)
	u.SetLabels(labels)
	u.Object["spec"] = spec
	return u
}

func traefikMiddlewareRefs(namespace string, middlewares ...*unstructured.Unstructured) string {
	refs := make([]string, len(middlewares))
	for i, mw := range middlewares {
		refs[i] = fmt.Sprintf("%s-%s@kubernetescrd", namespace, mw.GetName())
	}
	return strings.Join(refs, ",")
}
