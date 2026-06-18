package resourcebuilder

import (
	"github.com/unbindapp/unbind-operator/internal/resourcebuilder/networking"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

// BuildRoutes delegates to the active networking provider, which emits the
// controller-specific objects (Ingress, HTTPRoute, Middleware, ...) for the
// service's external routing. Returns networking.ErrRouteNotNeeded when the
// service exposes no public hosts/ports.
func (rb *ResourceBuilder) BuildRoutes() ([]client.Object, error) {
	return rb.provider.BuildRoutes(networking.RouteInput{
		Service: rb.service,
		Labels:  rb.getCommonLabels(),
	})
}
