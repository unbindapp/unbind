package controller

import (
	"context"
	"fmt"
	"slices"
	"strings"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"github.com/unbindapp/unbind-operator/internal/resourcebuilder/networking"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/util/workqueue"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

// listenerGateways names the Gateways of other services that carry the listeners of the
// hostnames this service shares with them
func (r *ServiceReconciler) listenerGateways(ctx context.Context, service *v1.Service) (map[string]string, error) {
	if r.NetworkingProvider != networking.ProviderGateway || len(service.Spec.Config.Hosts) == 0 {
		return nil, nil
	}
	var services v1.ServiceList
	if err := r.List(ctx, &services, client.InNamespace(service.Namespace)); err != nil {
		return nil, fmt.Errorf("listing services sharing a hostname: %w", err)
	}
	return networking.ListenerGateways(r.NetworkingConfig, service, services.Items), nil
}

// hostPeersHandler requeues the services sharing a hostname with one whose spec changed
func (r *ServiceReconciler) hostPeersHandler() handler.EventHandler {
	return handler.Funcs{
		CreateFunc: func(ctx context.Context, e event.CreateEvent, q workqueue.TypedRateLimitingInterface[reconcile.Request]) {
			r.enqueueHostPeers(ctx, q, e.Object)
		},
		UpdateFunc: func(ctx context.Context, e event.UpdateEvent, q workqueue.TypedRateLimitingInterface[reconcile.Request]) {
			if e.ObjectOld.GetGeneration() == e.ObjectNew.GetGeneration() && e.ObjectOld.GetDeletionTimestamp().Equal(e.ObjectNew.GetDeletionTimestamp()) {
				return
			}
			r.enqueueHostPeers(ctx, q, e.ObjectOld, e.ObjectNew)
		},
		DeleteFunc: func(ctx context.Context, e event.DeleteEvent, q workqueue.TypedRateLimitingInterface[reconcile.Request]) {
			r.enqueueHostPeers(ctx, q, e.Object)
		},
	}
}

func (r *ServiceReconciler) enqueueHostPeers(ctx context.Context, q workqueue.TypedRateLimitingInterface[reconcile.Request], changed ...client.Object) {
	hostnames := map[string]bool{}
	var changedKey types.NamespacedName
	for _, obj := range changed {
		service, ok := obj.(*v1.Service)
		if !ok {
			continue
		}
		changedKey = client.ObjectKeyFromObject(service)
		for _, host := range service.Spec.Config.Hosts {
			hostnames[strings.ToLower(host.Host)] = true
		}
	}
	if len(hostnames) == 0 {
		return
	}

	var services v1.ServiceList
	if err := r.List(ctx, &services, client.InNamespace(changedKey.Namespace)); err != nil {
		log.FromContext(ctx).Error(err, "Failed to list services sharing a hostname", "service", changedKey)
		return
	}
	for i := range services.Items {
		peer := &services.Items[i]
		if peer.Name == changedKey.Name {
			continue
		}
		if slices.ContainsFunc(peer.Spec.Config.Hosts, func(host v1.HostSpec) bool { return hostnames[strings.ToLower(host.Host)] }) {
			q.Add(reconcile.Request{NamespacedName: client.ObjectKeyFromObject(peer)})
		}
	}
}
