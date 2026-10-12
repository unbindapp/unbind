package k8s

import (
	"context"
	"fmt"
	"net/url"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// Matches the request timeout the operator puts on service routes
const platformRouteRequestTimeout = "21600s"

// EnsurePlatformRouteTimeouts adds request timeouts to the platform's HTTPRoute. Installs
// before the chart set them have none, and Envoy cuts those requests at its 15s default.
func (self *KubeClient) EnsurePlatformRouteTimeouts(ctx context.Context, uiURL string) error {
	parsed, err := url.Parse(uiURL)
	if err != nil || parsed.Hostname() == "" {
		return fmt.Errorf("reading UI host from %q: %v", uiURL, err)
	}

	routes, err := self.client.Resource(httpRouteGVR).Namespace(self.config.GetSystemNamespace()).List(ctx, metav1.ListOptions{})
	if apierrors.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("listing routes: %w", err)
	}

	for i := range routes.Items {
		route := &routes.Items[i]
		if !routeServesHost(route, parsed.Hostname()) || !setMissingRequestTimeouts(route) {
			continue
		}
		if _, err := self.client.Resource(httpRouteGVR).Namespace(route.GetNamespace()).Update(ctx, route, metav1.UpdateOptions{}); err != nil {
			return fmt.Errorf("updating route %s: %w", route.GetName(), err)
		}
	}
	return nil
}

func routeServesHost(route *unstructured.Unstructured, host string) bool {
	hostnames, _, _ := unstructured.NestedStringSlice(route.Object, "spec", "hostnames")
	return slices.Contains(hostnames, host)
}

func setMissingRequestTimeouts(route *unstructured.Unstructured) bool {
	rules, found, err := unstructured.NestedSlice(route.Object, "spec", "rules")
	if err != nil || !found {
		return false
	}

	changed := false
	for i, item := range rules {
		rule, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if _, set, _ := unstructured.NestedString(rule, "timeouts", "request"); set {
			continue
		}
		if err := unstructured.SetNestedField(rule, platformRouteRequestTimeout, "timeouts", "request"); err != nil {
			continue
		}
		rules[i] = rule
		changed = true
	}
	if !changed {
		return false
	}
	return unstructured.SetNestedSlice(route.Object, rules, "spec", "rules") == nil
}
