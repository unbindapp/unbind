package controller

import (
	"context"
	stderrors "errors"
	"fmt"
	"reflect"

	"github.com/go-logr/logr"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"github.com/unbindapp/unbind-operator/internal/resourcebuilder"
	"github.com/unbindapp/unbind-operator/internal/resourcebuilder/networking"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"
	gwapiv1 "sigs.k8s.io/gateway-api/apis/v1"
)

// reconcileDeployment ensures the Deployment exists and matches the desired spec,
// deleting any existing Deployment when one is no longer needed.
func (r *ServiceReconciler) reconcileDeployment(ctx context.Context, rb resourcebuilder.ResourceBuilderInterface, service v1.Service) error {
	desired, err := rb.BuildDeployment()
	if err == resourcebuilder.ErrDeploymentNotNeeded {
		return r.deleteIfExists(ctx, &appsv1.Deployment{}, service.Name, service.Namespace)
	}
	if err != nil {
		return fmt.Errorf("building deployment: %w", err)
	}

	return reconcileResource(ctx, r, desired, nil, maxReconcileRetries,
		func(existing, desired *appsv1.Deployment) bool {
			return !reflect.DeepEqual(existing.Spec, desired.Spec) ||
				!reflect.DeepEqual(existing.Labels, desired.Labels)
		},
		func(existing, desired *appsv1.Deployment) {
			existing.Labels = desired.Labels
			existing.Spec = desired.Spec
		},
		nil,
	)
}

// reconcileServices reconciles the ClusterIP and NodePort Services for the workload,
// removing any that are no longer part of the desired set.
func (r *ServiceReconciler) reconcileServices(ctx context.Context, rb resourcebuilder.ResourceBuilderInterface, service v1.Service) error {
	logger := log.FromContext(ctx)
	managedNames := []string{service.Name, service.Name + "-nodeport"}

	desiredServices, err := rb.BuildServices()
	if err == resourcebuilder.ErrServiceNotNeeded {
		return r.deleteKubeServices(ctx, managedNames, service.Namespace)
	}
	if err != nil {
		return fmt.Errorf("building services: %w", err)
	}

	desiredNames := make(map[string]bool, len(desiredServices))
	for _, desired := range desiredServices {
		desiredNames[desired.Name] = true
		if err := r.reconcileSingleKubeService(ctx, logger, desired, &service); err != nil {
			return err
		}
	}

	return r.cleanupUnneededKubeServices(ctx, managedNames, desiredNames, service.Namespace)
}

func (r *ServiceReconciler) reconcileSingleKubeService(ctx context.Context, logger logr.Logger, desired *corev1.Service, owner *v1.Service) error {
	return reconcileResource(ctx, r, desired, owner, maxReconcileRetries,
		func(existing, desired *corev1.Service) bool {
			copyImmutableServiceFields(desired, existing)
			return kubeServiceNeedsUpdate(logger, desired, existing)
		},
		func(existing, desired *corev1.Service) {
			existing.Spec = desired.Spec
		},
		nil,
	)
}

func (r *ServiceReconciler) deleteKubeServices(ctx context.Context, names []string, namespace string) error {
	for _, name := range names {
		if err := r.deleteIfExists(ctx, &corev1.Service{}, name, namespace); err != nil {
			return err
		}
	}
	return nil
}

func (r *ServiceReconciler) cleanupUnneededKubeServices(ctx context.Context, managedNames []string, desiredNames map[string]bool, namespace string) error {
	for _, name := range managedNames {
		if desiredNames[name] {
			continue
		}
		if err := r.deleteIfExists(ctx, &corev1.Service{}, name, namespace); err != nil {
			return err
		}
	}
	return nil
}

func copyImmutableServiceFields(desired, existing *corev1.Service) {
	desired.Spec.ClusterIP = existing.Spec.ClusterIP
	if desired.Spec.Type != corev1.ServiceTypeNodePort {
		return
	}
	for i := range desired.Spec.Ports {
		for j := range existing.Spec.Ports {
			if desired.Spec.Ports[i].Port == existing.Spec.Ports[j].Port &&
				desired.Spec.Ports[i].Name == existing.Spec.Ports[j].Name &&
				desired.Spec.Ports[i].NodePort == 0 {
				desired.Spec.Ports[i].NodePort = existing.Spec.Ports[j].NodePort
			}
		}
	}
}

func kubeServiceNeedsUpdate(logger logr.Logger, desired, existing *corev1.Service) bool {
	switch {
	case !reflect.DeepEqual(existing.Spec.Ports, desired.Spec.Ports):
		logger.Info("Service ports need update", "existing", existing.Spec.Ports, "desired", desired.Spec.Ports)
		return true
	case !reflect.DeepEqual(existing.Spec.Selector, desired.Spec.Selector):
		logger.Info("Service selector needs update")
		return true
	case existing.Spec.Type != desired.Spec.Type:
		logger.Info("Service type needs update", "from", existing.Spec.Type, "to", desired.Spec.Type)
		return true
	default:
		return false
	}
}

// reconcileRoutes reconciles the heterogeneous set of routing objects produced by
// the active networking provider (Ingress, HTTPRoute, Middleware, ...), garbage
// collecting any owned routing objects of any kind that are no longer desired so
// switching providers self-heals.
func (r *ServiceReconciler) reconcileRoutes(ctx context.Context, rb resourcebuilder.ResourceBuilderInterface, service v1.Service) error {
	desired, err := rb.BuildRoutes()
	if err != nil && !stderrors.Is(err, networking.ErrRouteNotNeeded) {
		return fmt.Errorf("building routes: %w", err)
	}

	desiredKeys := make(map[string]bool, len(desired))
	for _, obj := range desired {
		key, keyErr := r.routeKey(obj)
		if keyErr != nil {
			return keyErr
		}
		desiredKeys[key] = true
		if err := r.reconcileRouteObject(ctx, obj, &service); err != nil {
			return err
		}
	}

	return r.cleanupStaleRoutes(ctx, &service, desiredKeys)
}

// reconcileRouteObject applies a single routing object. Typed built-in/Gateway
// API kinds go through the get/update path; CRD kinds delivered as unstructured
// (Traefik Middleware, Envoy BackendTrafficPolicy) use server-side apply.
func (r *ServiceReconciler) reconcileRouteObject(ctx context.Context, desired client.Object, owner *v1.Service) error {
	switch obj := desired.(type) {
	case *networkingv1.Ingress:
		return reconcileResource(ctx, r, obj, owner, maxReconcileRetries,
			func(existing, desired *networkingv1.Ingress) bool {
				return !reflect.DeepEqual(existing.Spec, desired.Spec)
			},
			func(existing, desired *networkingv1.Ingress) {
				existing.Spec = desired.Spec
			},
			nil,
		)
	case *gwapiv1.HTTPRoute:
		return reconcileResource(ctx, r, obj, owner, maxReconcileRetries,
			func(existing, desired *gwapiv1.HTTPRoute) bool {
				return !reflect.DeepEqual(existing.Spec, desired.Spec) ||
					!reflect.DeepEqual(existing.Labels, desired.Labels)
			},
			func(existing, desired *gwapiv1.HTTPRoute) {
				existing.Spec = desired.Spec
				existing.Labels = desired.Labels
			},
			nil,
		)
	case *gwapiv1.Gateway:
		return reconcileResource(ctx, r, obj, owner, maxReconcileRetries,
			func(existing, desired *gwapiv1.Gateway) bool {
				return !reflect.DeepEqual(existing.Spec, desired.Spec) ||
					!reflect.DeepEqual(existing.Labels, desired.Labels) ||
					!reflect.DeepEqual(existing.Annotations, desired.Annotations)
			},
			func(existing, desired *gwapiv1.Gateway) {
				existing.Spec = desired.Spec
				existing.Labels = desired.Labels
				existing.Annotations = desired.Annotations
			},
			nil,
		)
	default:
		return r.applyRoute(ctx, desired, owner)
	}
}

// deleteIfExists deletes the named object, treating a missing object as success.
func (r *ServiceReconciler) deleteIfExists(ctx context.Context, obj client.Object, name, namespace string) error {
	logger := log.FromContext(ctx)
	if err := r.Get(ctx, types.NamespacedName{Name: name, Namespace: namespace}, obj); err != nil {
		if errors.IsNotFound(err) {
			return nil
		}
		return fmt.Errorf("checking if %T %s exists: %w", obj, name, err)
	}
	logger.Info("Deleting resource", "kind", fmt.Sprintf("%T", obj), "name", name)
	if err := r.Delete(ctx, obj); err != nil {
		return fmt.Errorf("deleting %T %s: %w", obj, name, err)
	}
	return nil
}
