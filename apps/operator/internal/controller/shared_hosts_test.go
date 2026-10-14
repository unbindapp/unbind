package controller

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"github.com/unbindapp/unbind-operator/internal/resourcebuilder/networking"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/util/workqueue"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

func serviceWithHosts(name string, hosts ...v1.HostSpec) *v1.Service {
	return &v1.Service{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "team"},
		Spec: v1.ServiceSpec{Config: v1.ServiceConfigSpec{
			Public: true,
			Hosts:  hosts,
			Ports:  []v1.PortSpec{{Port: 3000}},
		}},
	}
}

func queued(q workqueue.TypedRateLimitingInterface[reconcile.Request]) []string {
	var names []string
	for q.Len() > 0 {
		request, _ := q.Get()
		names = append(names, request.Name)
		q.Done(request)
	}
	return names
}

func TestEnqueueHostPeers(t *testing.T) {
	ctx := context.Background()
	s := runtime.NewScheme()
	require.NoError(t, scheme.AddToScheme(s))
	require.NoError(t, v1.AddToScheme(s))

	frontend := serviceWithHosts("frontend", v1.HostSpec{Host: "example.com", Path: "/"})
	inquire := serviceWithHosts("inquire", v1.HostSpec{Host: "Example.com", Path: "/inquire"})
	other := serviceWithHosts("other", v1.HostSpec{Host: "other.com", Path: "/"})
	c := fake.NewClientBuilder().WithScheme(s).WithObjects(frontend, inquire, other).Build()
	r := &ServiceReconciler{Client: c, Scheme: s, NetworkingProvider: networking.ProviderGateway}

	q := workqueue.NewTypedRateLimitingQueue(workqueue.DefaultTypedControllerRateLimiter[reconcile.Request]())
	defer q.ShutDown()

	r.enqueueHostPeers(ctx, q, frontend)
	assert.Equal(t, []string{"inquire"}, queued(q), "a peer on the same hostname is requeued, others are not")

	withoutDomain := serviceWithHosts("frontend")
	r.enqueueHostPeers(ctx, q, frontend, withoutDomain)
	assert.Equal(t, []string{"inquire"}, queued(q), "giving a hostname up requeues the services left on it")

	r.enqueueHostPeers(ctx, q, other)
	assert.Empty(t, queued(q))

	gateways, err := r.listenerGateways(ctx, inquire)
	require.NoError(t, err)
	assert.Equal(t, map[string]string{"example.com": "frontend"}, gateways)

	r.NetworkingProvider = networking.ProviderNginx
	gateways, err = r.listenerGateways(ctx, inquire)
	require.NoError(t, err)
	assert.Nil(t, gateways, "ingress controllers merge paths across Ingresses on their own")
}
