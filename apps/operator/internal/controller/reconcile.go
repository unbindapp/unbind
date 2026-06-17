package controller

import (
	"context"
	"fmt"
	"reflect"
	"time"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"
)

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
