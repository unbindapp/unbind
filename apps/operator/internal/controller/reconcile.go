package controller

import (
	"context"
	"fmt"
	"reflect"
	"time"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"github.com/unbindapp/unbind-operator/internal/resourcebuilder/networking"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/apiutil"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"
)

const routeInstanceLabel = "app.kubernetes.io/instance"

// routeKey is a stable GVK+name identifier for a routing object, matched against
// the keys produced while listing existing objects during garbage collection.
func (r *ServiceReconciler) routeKey(obj client.Object) (string, error) {
	gvk := obj.GetObjectKind().GroupVersionKind()
	if gvk.Empty() {
		var err error
		gvk, err = apiutil.GVKForObject(obj, r.Scheme)
		if err != nil {
			return "", fmt.Errorf("resolving GVK for %s: %w", obj.GetName(), err)
		}
	}
	return gvk.String() + "/" + obj.GetName(), nil
}

// applyRoute creates or updates an unstructured routing object (Traefik Middleware,
// Envoy BackendTrafficPolicy), preserving the resourceVersion on update.
func (r *ServiceReconciler) applyRoute(ctx context.Context, desired client.Object, owner *v1.Service) error {
	if owner != nil {
		if err := controllerutil.SetControllerReference(owner, desired, r.Scheme); err != nil {
			return fmt.Errorf("setting controller reference: %w", err)
		}
	}
	logger := log.FromContext(ctx)
	kind := desired.GetObjectKind().GroupVersionKind().Kind

	existing := &unstructured.Unstructured{}
	existing.SetGroupVersionKind(desired.GetObjectKind().GroupVersionKind())
	err := r.Get(ctx, client.ObjectKeyFromObject(desired), existing)
	if errors.IsNotFound(err) {
		logger.Info("Creating route", "kind", kind, "name", desired.GetName())
		return r.Create(ctx, desired)
	}
	if err != nil {
		return fmt.Errorf("getting %s %s: %w", kind, desired.GetName(), err)
	}

	desired.SetResourceVersion(existing.GetResourceVersion())
	logger.Info("Updating route", "kind", kind, "name", desired.GetName())
	return r.Update(ctx, desired)
}

// cleanupStaleRoutes deletes every owned routing object, of any provider's kind,
// whose GVK+name is absent from desired. A nil desired map deletes them all.
// Kinds whose CRD is not installed are skipped.
func (r *ServiceReconciler) cleanupStaleRoutes(ctx context.Context, service *v1.Service, desired map[string]bool) error {
	logger := log.FromContext(ctx)
	for _, gvk := range networking.RouteGVKs() {
		list := &unstructured.UnstructuredList{}
		listGVK := gvk
		listGVK.Kind = gvk.Kind + "List"
		list.SetGroupVersionKind(listGVK)

		err := r.List(ctx, list,
			client.InNamespace(service.Namespace),
			client.MatchingLabels{routeInstanceLabel: service.Name},
		)
		if err != nil {
			if meta.IsNoMatchError(err) || errors.IsNotFound(err) {
				continue
			}
			return fmt.Errorf("listing %s: %w", gvk.Kind, err)
		}

		for i := range list.Items {
			item := &list.Items[i]
			if desired[gvk.String()+"/"+item.GetName()] {
				continue
			}
			stale := &unstructured.Unstructured{}
			stale.SetGroupVersionKind(gvk)
			stale.SetNamespace(item.GetNamespace())
			stale.SetName(item.GetName())
			logger.Info("Deleting stale route", "kind", gvk.Kind, "name", item.GetName())
			if err := r.Delete(ctx, stale); client.IgnoreNotFound(err) != nil {
				return fmt.Errorf("deleting %s %s: %w", gvk.Kind, item.GetName(), err)
			}
		}
	}
	return nil
}

const (
	maxReconcileRetries     = 5
	singleReconcileAttempt  = 1
	initialReconcileBackoff = time.Second
)

// reconcileResource creates or updates a single owned resource, retrying on
// optimistic-concurrency conflicts. When owner is non-nil a controller reference
// is set before the resource is persisted. needsUpdate reports whether an existing
// object differs from desired (and may normalise desired against immutable fields),
// applyUpdate mutates existing into the desired state, and afterReconcile (optional)
// runs only when an existing object was found - never on the initial create.
func reconcileResource[T client.Object](
	ctx context.Context,
	r *ServiceReconciler,
	desired T,
	owner *v1.Service,
	attempts int,
	needsUpdate func(existing, desired T) bool,
	applyUpdate func(existing, desired T),
	afterReconcile func(ctx context.Context) error,
) error {
	logger := log.FromContext(ctx)
	kind := fmt.Sprintf("%T", desired)

	if owner != nil {
		if err := controllerutil.SetControllerReference(owner, desired, r.Scheme); err != nil {
			return fmt.Errorf("setting controller reference: %w", err)
		}
	}

	backoff := initialReconcileBackoff
	for attempt := range attempts {
		existing := newEmptyLike(desired)
		err := r.Get(ctx, client.ObjectKeyFromObject(desired), existing)
		if errors.IsNotFound(err) {
			logger.Info("Creating resource", "kind", kind, "name", desired.GetName())
			return r.Create(ctx, desired)
		}
		if err != nil {
			return fmt.Errorf("getting %s %s: %w", kind, desired.GetName(), err)
		}

		if needsUpdate(existing, desired) {
			applyUpdate(existing, desired)
			if owner != nil {
				if err := controllerutil.SetControllerReference(owner, existing, r.Scheme); err != nil {
					return fmt.Errorf("setting controller reference: %w", err)
				}
			}
			logger.Info("Updating resource", "kind", kind, "name", desired.GetName())
			if err := r.Update(ctx, existing); err != nil {
				if errors.IsConflict(err) && attempt < attempts-1 {
					logger.Info("Resource was modified, retrying update", "kind", kind, "name", desired.GetName(), "attempt", attempt+1)
					time.Sleep(backoff)
					backoff *= 2
					continue
				}
				return fmt.Errorf("updating %s %s: %w", kind, desired.GetName(), err)
			}
		}

		if afterReconcile != nil {
			return afterReconcile(ctx)
		}
		return nil
	}

	return fmt.Errorf("failed to reconcile %s after %d attempts", kind, attempts)
}

// newEmptyLike returns a freshly allocated, empty object of the same concrete type as obj.
func newEmptyLike[T client.Object](obj T) T {
	return reflect.New(reflect.TypeOf(obj).Elem()).Interface().(T)
}
