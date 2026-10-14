package controller

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
	discoveryv1 "k8s.io/api/discovery/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes/scheme"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func TestCleanupStaleRoutesKeepsNonRouteSecrets(t *testing.T) {
	ctx := context.Background()
	s := runtime.NewScheme()
	require.NoError(t, scheme.AddToScheme(s))
	require.NoError(t, v1.AddToScheme(s))

	service := &v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "postgres-x", Namespace: "team", UID: types.UID("svc-uid")}}
	owned := func(name string) *corev1.Secret {
		return &corev1.Secret{ObjectMeta: metav1.ObjectMeta{
			Name:            name,
			Namespace:       "team",
			Labels:          map[string]string{routeInstanceLabel: "postgres-x"},
			OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(service, v1.GroupVersion.WithKind("Service"))},
		}}
	}
	credentials := owned("primarydb.postgres-x.credentials.postgresql.acid.zalan.do")
	staleAuth := owned("postgres-x-htpasswd")

	c := fake.NewClientBuilder().WithScheme(s).WithObjects(service, credentials, staleAuth).Build()
	r := &ServiceReconciler{Client: c, Scheme: s}

	require.NoError(t, r.cleanupStaleRoutes(ctx, service, map[string]bool{}))

	assert.NoError(t, c.Get(ctx, client.ObjectKeyFromObject(credentials), &corev1.Secret{}), "database credentials survive route cleanup")
	assert.True(t, kerrors.IsNotFound(c.Get(ctx, client.ObjectKeyFromObject(staleAuth), &corev1.Secret{})), "a stale basic auth secret is removed")
}

func TestCleanupStaleRoutesOnlyRemovesProxyUpstreams(t *testing.T) {
	ctx := context.Background()
	s := runtime.NewScheme()
	require.NoError(t, scheme.AddToScheme(s))
	require.NoError(t, v1.AddToScheme(s))

	service := &v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "web-x", Namespace: "team", UID: types.UID("svc-uid")}}
	controller := []metav1.OwnerReference{*metav1.NewControllerRef(service, v1.GroupVersion.WithKind("Service"))}
	meta := func(name string, owners []metav1.OwnerReference) metav1.ObjectMeta {
		return metav1.ObjectMeta{Name: name, Namespace: "team", Labels: map[string]string{routeInstanceLabel: "web-x"}, OwnerReferences: owners}
	}
	kubeService := &corev1.Service{ObjectMeta: meta("web-x", controller)}
	kubeServiceSlice := &discoveryv1.EndpointSlice{ObjectMeta: meta("web-x-7kq2p", nil), AddressType: discoveryv1.AddressTypeIPv4}
	databaseService := &corev1.Service{ObjectMeta: meta("web-x-db", controller)}
	foreignProxyName := &corev1.Service{ObjectMeta: meta("proxy-0123456789", nil)}
	staleUpstream := &corev1.Service{ObjectMeta: meta("proxy-aaaaaaaaaa", controller)}
	staleUpstreamSlice := &discoveryv1.EndpointSlice{ObjectMeta: meta("proxy-aaaaaaaaaa", controller), AddressType: discoveryv1.AddressTypeFQDN}
	desiredUpstream := &corev1.Service{ObjectMeta: meta("proxy-bbbbbbbbbb", controller)}

	c := fake.NewClientBuilder().WithScheme(s).WithObjects(
		service, kubeService, kubeServiceSlice, databaseService, foreignProxyName, staleUpstream, staleUpstreamSlice, desiredUpstream,
	).Build()
	r := &ServiceReconciler{Client: c, Scheme: s}

	require.NoError(t, r.cleanupStaleRoutes(ctx, service, map[string]bool{"/v1, Kind=Service/proxy-bbbbbbbbbb": true}))

	for _, kept := range []client.Object{kubeService, databaseService, foreignProxyName, desiredUpstream} {
		assert.NoError(t, c.Get(ctx, client.ObjectKeyFromObject(kept), &corev1.Service{}), "service %s survives route cleanup", kept.GetName())
	}
	assert.NoError(t, c.Get(ctx, client.ObjectKeyFromObject(kubeServiceSlice), &discoveryv1.EndpointSlice{}), "the service's own endpoint slice survives")
	assert.True(t, kerrors.IsNotFound(c.Get(ctx, client.ObjectKeyFromObject(staleUpstream), &corev1.Service{})), "a stale proxy upstream is removed")
	assert.True(t, kerrors.IsNotFound(c.Get(ctx, client.ObjectKeyFromObject(staleUpstreamSlice), &discoveryv1.EndpointSlice{})), "a stale proxy endpoint slice is removed")
}

func TestRemoveExposureKeepsServiceObjects(t *testing.T) {
	ctx := context.Background()
	s := runtime.NewScheme()
	require.NoError(t, scheme.AddToScheme(s))
	require.NoError(t, v1.AddToScheme(s))

	service := &v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "pg-x", Namespace: "team", UID: types.UID("svc-uid")}}
	controller := []metav1.OwnerReference{*metav1.NewControllerRef(service, v1.GroupVersion.WithKind("Service"))}
	labels := map[string]string{routeInstanceLabel: "pg-x"}
	credentials := &corev1.Secret{ObjectMeta: metav1.ObjectMeta{Name: "pg-x-credentials", Namespace: "team", Labels: labels, OwnerReferences: controller}}
	exposure := &corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: "pg-x-db", Namespace: "team", Labels: labels, OwnerReferences: controller}}

	c := fake.NewClientBuilder().WithScheme(s).WithObjects(service, credentials, exposure).Build()
	r := &ServiceReconciler{Client: c, Scheme: s}

	require.NoError(t, r.cleanupStaleRoutes(ctx, service, nil))

	assert.NoError(t, c.Get(ctx, client.ObjectKeyFromObject(credentials), &corev1.Secret{}), "removing every route keeps the credentials")
	assert.NoError(t, c.Get(ctx, client.ObjectKeyFromObject(exposure), &corev1.Service{}), "removing every route keeps the database service")
}
