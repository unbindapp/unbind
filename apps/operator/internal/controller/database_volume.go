package controller

import (
	"context"

	"github.com/unbindapp/unbind-api/pkg/databases"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

const serviceLabel = "unbind-service"

// Resizes land on the claims while the size recorded in the spec stays frozen, so the real size
// comes from the claims. The smallest one counts, empty until a claim is bound.
func (r *ServiceReconciler) dataVolumeCapacity(ctx context.Context, service *v1.Service) (string, error) {
	replicas := 1
	if service.Spec.Config.Replicas != nil {
		replicas = int(*service.Spec.Config.Replicas)
	}
	claims := databases.StatefulSetClaimNames(service.Spec.Config.Database.Type, service.Name, service.Spec.ServiceRef, replicas)

	var smallest *resource.Quantity
	for _, name := range claims {
		claim := &corev1.PersistentVolumeClaim{}
		if err := r.Get(ctx, types.NamespacedName{Namespace: service.Namespace, Name: name}, claim); err != nil {
			if client.IgnoreNotFound(err) == nil {
				continue
			}
			return "", err
		}
		capacity, ok := claim.Status.Capacity[corev1.ResourceStorage]
		if !ok {
			continue
		}
		if smallest == nil || capacity.Cmp(*smallest) < 0 {
			smallest = &capacity
		}
	}
	if smallest == nil {
		return "", nil
	}
	return smallest.String(), nil
}

func (r *ServiceReconciler) servicesForClaim(ctx context.Context, claim client.Object) []reconcile.Request {
	serviceRef := claim.GetLabels()[serviceLabel]
	if serviceRef == "" {
		return nil
	}
	services := &v1.ServiceList{}
	if err := r.List(ctx, services, client.InNamespace(claim.GetNamespace())); err != nil {
		return nil
	}
	var requests []reconcile.Request
	for _, service := range services.Items {
		if service.Spec.Type != "database" || service.Spec.ServiceRef != serviceRef {
			continue
		}
		requests = append(requests, reconcile.Request{NamespacedName: types.NamespacedName{Namespace: service.Namespace, Name: service.Name}})
	}
	return requests
}

var claimCapacityChanged = predicate.Funcs{
	CreateFunc:  func(event.CreateEvent) bool { return false },
	DeleteFunc:  func(event.DeleteEvent) bool { return false },
	GenericFunc: func(event.GenericEvent) bool { return false },
	UpdateFunc: func(e event.UpdateEvent) bool {
		before, ok := e.ObjectOld.(*corev1.PersistentVolumeClaim)
		if !ok {
			return false
		}
		after, ok := e.ObjectNew.(*corev1.PersistentVolumeClaim)
		if !ok {
			return false
		}
		if after.Labels[serviceLabel] == "" {
			return false
		}
		return before.Status.Capacity.Storage().Cmp(*after.Status.Capacity.Storage()) != 0
	},
}
