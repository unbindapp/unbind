package controller

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"github.com/unbindapp/unbind-operator/internal/resourcebuilder"
	corev1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes/scheme"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func TestReconcileRenderedMounts(t *testing.T) {
	ctx := context.Background()
	s := runtime.NewScheme()
	require.NoError(t, scheme.AddToScheme(s))
	require.NoError(t, v1.AddToScheme(s))

	service := &v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "gc", Namespace: "team", UID: types.UID("svc-uid")}}
	service.Spec.KubernetesSecret = "gc"
	service.Spec.Config.VariableMounts = []v1.VariableMountSpec{{Name: "TOKEN", Path: "/secrets/token"}}
	service.Spec.EnvVars = []corev1.EnvVar{{Name: "TOKEN", Value: "first"}}

	c := fake.NewClientBuilder().WithScheme(s).WithObjects(service).Build()
	r := &ServiceReconciler{Client: c, Scheme: s}
	key := client.ObjectKey{Namespace: "team", Name: "gc-mounts"}
	reconcile := func() {
		require.NoError(t, r.reconcileRenderedMounts(ctx, resourcebuilder.NewResourceBuilder(service, s, nil), *service))
	}

	reconcile()
	secret := &corev1.Secret{}
	require.NoError(t, c.Get(ctx, key, secret))
	assert.Equal(t, []byte("first"), secret.Data["TOKEN"])
	assert.True(t, metav1.IsControlledBy(secret, service), "the secret goes when the service goes")

	service.Spec.EnvVars = []corev1.EnvVar{{Name: "TOKEN", Value: "second"}}
	reconcile()
	require.NoError(t, c.Get(ctx, key, secret))
	assert.Equal(t, []byte("second"), secret.Data["TOKEN"], "a new rendered value replaces the old one")

	service.Spec.EnvVars = nil
	reconcile()
	assert.True(t, kerrors.IsNotFound(c.Get(ctx, key, &corev1.Secret{})), "no rendered mount, no secret")
}
