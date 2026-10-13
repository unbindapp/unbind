package controller

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
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
