package networking

import (
	"fmt"
	"strings"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

type traefikProvider struct{}

func (traefikProvider) Name() Provider { return ProviderTraefik }

func (traefikProvider) ServiceAnnotations(svc *v1.Service) map[string]string {
	return map[string]string{
		"traefik.ingress.kubernetes.io/service.sticky.cookie":        "true",
		"traefik.ingress.kubernetes.io/service.sticky.cookie.name":   fmt.Sprintf("%s-session", svc.Name),
		"traefik.ingress.kubernetes.io/service.sticky.cookie.maxage": "172800",
	}
}

func (traefikProvider) BuildRoutes(in RouteInput) ([]client.Object, error) {
	svc := in.Service
	if !needsRoutes(svc) {
		return nil, ErrRouteNotNeeded
	}

	redirect := traefikMiddleware(svc.Name+"-redirect", svc.Namespace, in.Labels, map[string]any{
		"redirectScheme": map[string]any{"scheme": "https", "permanent": true},
	})
	buffering := traefikMiddleware(svc.Name+"-buffering", svc.Namespace, in.Labels, map[string]any{
		"buffering": map[string]any{"maxRequestBodyBytes": int64(10 << 20)},
	})

	annotations := map[string]string{
		"kubernetes.io/tls-acme":                           "true",
		"traefik.ingress.kubernetes.io/router.entrypoints": "websecure",
		"traefik.ingress.kubernetes.io/router.middlewares": traefikMiddlewareRefs(svc.Namespace, redirect, buffering),
	}
	ingress := buildIngress(in, "traefik", annotations)

	return []client.Object{ingress, redirect, buffering}, nil
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
