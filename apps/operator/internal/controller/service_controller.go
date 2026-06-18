/*
Copyright 2025.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package controller

import (
	"context"
	"fmt"
	"reflect"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"github.com/unbindapp/unbind-operator/internal/operator"
	"github.com/unbindapp/unbind-operator/internal/resourcebuilder"
	"github.com/unbindapp/unbind-operator/internal/resourcebuilder/networking"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"
	gwapiv1 "sigs.k8s.io/gateway-api/apis/v1"
)

const serviceFinalizer = "service.unbind.unbind.app/finalizer"

// ServiceReconciler reconciles a Service object
type ServiceReconciler struct {
	client.Client
	Scheme             *runtime.Scheme
	OperatorManager    *operator.OperatorManager
	NetworkingProvider networking.Provider
	NetworkingConfig   networking.Config
}

func (r *ServiceReconciler) newResourceBuilder(service *v1.Service) resourcebuilder.ResourceBuilderInterface {
	provider := networking.New(r.NetworkingProvider, r.NetworkingConfig)
	return resourcebuilder.NewResourceBuilder(service, r.Scheme, provider)
}

// +kubebuilder:rbac:groups=unbind.unbind.app,resources=services,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=unbind.unbind.app,resources=services/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=unbind.unbind.app,resources=services/finalizers,verbs=update
// +kubebuilder:rbac:groups=apps,resources=deployments,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=apps,resources=statefulsets,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups="",resources=persistentvolumeclaims,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups="",resources=serviceaccounts,verbs=get;list;watch
// +kubebuilder:rbac:groups=core,resources=services,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=core,resources=configmaps,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=networking.k8s.io,resources=ingresses,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=networking.k8s.io,resources=ingressclasses,verbs=get;list;watch
// +kubebuilder:rbac:groups=gateway.networking.k8s.io,resources=httproutes;gateways,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=gateway.networking.k8s.io,resources=gatewayclasses,verbs=get;list;watch
// +kubebuilder:rbac:groups=gateway.envoyproxy.io,resources=backendtrafficpolicies,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=traefik.io,resources=middlewares,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=core,resources=secrets,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=batch,resources=cronjobs,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=acid.zalan.do,resources=postgresqls,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=helm.toolkit.fluxcd.io,resources=helmreleases,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=source.toolkit.fluxcd.io,resources=helmrepositories,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=helm.toolkit.fluxcd.io,resources=helmreleases/status,verbs=get
// +kubebuilder:rbac:groups=source.toolkit.fluxcd.io,resources=helmrepositories/status,verbs=get
// +kubebuilder:rbac:groups=moco.cybozu.com,resources=mysqlclusters,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=moco.cybozu.com,resources=backuppolicies,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=clickhouse.altinity.com,resources=clickhouseinstallations,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=batch,resources=jobs,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=batch,resources=jobs/status,verbs=get;update;patch

// Reconcile is the main reconciliation loop for the Service resource
func (r *ServiceReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	logger := log.FromContext(ctx)
	logger.Info("Reconciling Service", "service", req.NamespacedName)

	var service v1.Service
	if err := r.Get(ctx, req.NamespacedName, &service); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	if !service.DeletionTimestamp.IsZero() {
		if !controllerutil.ContainsFinalizer(&service, serviceFinalizer) {
			return ctrl.Result{}, nil
		}
		if err := r.finalizeService(ctx, &service); err != nil {
			return ctrl.Result{}, fmt.Errorf("failed to finalize service: %w", err)
		}
		controllerutil.RemoveFinalizer(&service, serviceFinalizer)
		if err := r.Update(ctx, &service); err != nil {
			return ctrl.Result{}, fmt.Errorf("failed to remove finalizer: %w", err)
		}
		return ctrl.Result{}, nil
	}

	// Adding the finalizer triggers another reconciliation, so return early.
	if !controllerutil.ContainsFinalizer(&service, serviceFinalizer) {
		controllerutil.AddFinalizer(&service, serviceFinalizer)
		if err := r.Update(ctx, &service); err != nil {
			return ctrl.Result{}, fmt.Errorf("failed to add finalizer: %w", err)
		}
		return ctrl.Result{}, nil
	}

	if err := r.reconcileResources(ctx, &service); err != nil {
		return ctrl.Result{}, err
	}

	if err := r.updateServiceStatus(ctx, &service); err != nil {
		logger.Error(err, "Failed to update Service status")
		return ctrl.Result{}, err
	}

	return ctrl.Result{}, nil
}

// reconcileResources translates the Service spec into the backing Kubernetes resources.
func (r *ServiceReconciler) reconcileResources(ctx context.Context, service *v1.Service) error {
	logger := log.FromContext(ctx)
	rb := r.newResourceBuilder(service)

	if service.Spec.Type == "database" {
		if err := r.reconcileDatabase(ctx, rb, *service); err != nil {
			logger.Error(err, "Failed to reconcile database")
			return err
		}
		return nil
	}

	if err := r.reconcileDeployment(ctx, rb, *service); err != nil {
		logger.Error(err, "Failed to reconcile Deployment")
		return err
	}
	if err := r.reconcileServices(ctx, rb, *service); err != nil {
		logger.Error(err, "Failed to reconcile Service")
		return err
	}
	if err := r.reconcileRoutes(ctx, rb, *service); err != nil {
		logger.Error(err, "Failed to reconcile routes")
		return err
	}
	return nil
}

// updateServiceStatus refreshes the Service status subresource when it has drifted.
func (r *ServiceReconciler) updateServiceStatus(ctx context.Context, service *v1.Service) error {
	var newURLs []string
	if len(service.Spec.Config.Hosts) > 0 && service.Spec.Config.Public {
		for _, host := range service.Spec.Config.Hosts {
			newURLs = append(newURLs, fmt.Sprintf("https://%s", host.Host))
		}
	}

	needsStatusUpdate := false
	if service.Status.DeploymentStatus != "Ready" {
		service.Status.DeploymentStatus = "Ready"
		needsStatusUpdate = true
	}
	if !reflect.DeepEqual(service.Status.URLs, newURLs) {
		service.Status.URLs = newURLs
		needsStatusUpdate = true
	}

	if !needsStatusUpdate {
		return nil
	}
	return r.Status().Update(ctx, service)
}

// finalizeService handles resource cleanup when the Service CR is being deleted.
// Owned resources are garbage collected via owner references, but we delete the
// core workload resources explicitly so they are gone before the finalizer is removed.
func (r *ServiceReconciler) finalizeService(ctx context.Context, service *v1.Service) error {
	logger := log.FromContext(ctx)
	logger.Info("Finalizing Service", "service", fmt.Sprintf("%s/%s", service.Namespace, service.Name))

	objects := []client.Object{
		&appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: service.Name, Namespace: service.Namespace}},
		&corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: service.Name, Namespace: service.Namespace}},
	}
	for _, obj := range objects {
		if err := r.Delete(ctx, obj); client.IgnoreNotFound(err) != nil {
			return fmt.Errorf("failed to delete %T: %w", obj, err)
		}
	}

	if err := r.cleanupStaleRoutes(ctx, service, nil); err != nil {
		return fmt.Errorf("failed to delete routes: %w", err)
	}

	logger.Info("Service finalization complete")
	return nil
}

// SetupWithManager sets up the controller with the Manager. The HTTPRoute watch
// is only registered when the gateway provider is active, since the Gateway API
// CRDs are absent on legacy ingress-nginx/traefik clusters.
func (r *ServiceReconciler) SetupWithManager(mgr ctrl.Manager) error {
	builder := ctrl.NewControllerManagedBy(mgr).
		For(&v1.Service{}).
		Owns(&appsv1.Deployment{}).
		Owns(&corev1.Service{}).
		Owns(&networkingv1.Ingress{})

	if r.NetworkingProvider == networking.ProviderGateway {
		builder = builder.Owns(&gwapiv1.HTTPRoute{}).Owns(&gwapiv1.Gateway{})
	}

	return builder.Complete(r)
}
