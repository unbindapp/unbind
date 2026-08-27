package controller

import (
	"context"
	"testing"

	helmv2 "github.com/fluxcd/helm-controller/api/v2"
	fluxmeta "github.com/fluxcd/pkg/apis/meta"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes/scheme"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
)

func TestReleaseFailedOnImmutableStatefulSet(t *testing.T) {
	immutableMessage := "upgrade failed: StatefulSet.apps \"repro-redis\" is invalid: spec: Forbidden: updates to statefulset spec for fields other than 'replicas'"

	release := func(conditions ...metav1.Condition) *helmv2.HelmRelease {
		return &helmv2.HelmRelease{Status: helmv2.HelmReleaseStatus{Conditions: conditions}}
	}

	tests := []struct {
		name     string
		release  *helmv2.HelmRelease
		expected bool
	}{
		{
			name:     "no conditions",
			release:  release(),
			expected: false,
		},
		{
			name:     "ready",
			release:  release(metav1.Condition{Type: fluxmeta.ReadyCondition, Status: metav1.ConditionTrue}),
			expected: false,
		},
		{
			name:     "stalled with immutable error",
			release:  release(metav1.Condition{Type: fluxmeta.StalledCondition, Status: metav1.ConditionTrue, Message: immutableMessage}),
			expected: true,
		},
		{
			name:     "ready false with immutable error",
			release:  release(metav1.Condition{Type: fluxmeta.ReadyCondition, Status: metav1.ConditionFalse, Message: immutableMessage}),
			expected: true,
		},
		{
			name:     "ready false with unrelated error",
			release:  release(metav1.Condition{Type: fluxmeta.ReadyCondition, Status: metav1.ConditionFalse, Message: "values don't meet the specifications of the schema"}),
			expected: false,
		},
		{
			name:     "stalled false with immutable error message",
			release:  release(metav1.Condition{Type: fluxmeta.StalledCondition, Status: metav1.ConditionFalse, Message: immutableMessage}),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, releaseFailedOnImmutableStatefulSet(tt.release))
		})
	}
}

func remediationScheme(t *testing.T) *runtime.Scheme {
	s := runtime.NewScheme()
	require.NoError(t, scheme.AddToScheme(s))
	require.NoError(t, v1.AddToScheme(s))
	require.NoError(t, helmv2.AddToScheme(s))
	return s
}

func remediationFixtures(releaseConditions []metav1.Condition, storageSize string) (*v1.Service, *helmv2.HelmRelease, *appsv1.StatefulSet, *corev1.PersistentVolumeClaim) {
	controller := true
	storage := resource.MustParse(storageSize)
	service := &v1.Service{
		ObjectMeta: metav1.ObjectMeta{Name: "my-redis", Namespace: "team-ns", UID: types.UID("svc-uid")},
		Spec: v1.ServiceSpec{
			Type: "database",
			Config: v1.ServiceConfigSpec{
				Database: v1.DatabaseSpec{
					Type:   "redis",
					Config: &v1.DatabaseConfigSpec{StorageSize: &storage},
				},
			},
		},
	}
	release := &helmv2.HelmRelease{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "my-redis",
			Namespace: "team-ns",
			OwnerReferences: []metav1.OwnerReference{
				{APIVersion: "unbind.unbind.app/v1", Kind: "Service", Name: "my-redis", UID: types.UID("svc-uid"), Controller: &controller},
			},
		},
		Status: helmv2.HelmReleaseStatus{Conditions: releaseConditions},
	}
	labels := map[string]string{"app.kubernetes.io/instance": "my-redis"}
	statefulSet := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{Name: "my-redis-redis", Namespace: "team-ns", Labels: labels},
	}
	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{Name: "data-my-redis-redis-0", Namespace: "team-ns", Labels: labels},
		Spec: corev1.PersistentVolumeClaimSpec{
			Resources: corev1.VolumeResourceRequirements{
				Requests: corev1.ResourceList{corev1.ResourceStorage: resource.MustParse("1Gi")},
			},
		},
	}
	return service, release, statefulSet, pvc
}

func TestRemediateStalledDatabaseRelease(t *testing.T) {
	ctx := context.Background()
	immutableFailure := []metav1.Condition{
		{Type: fluxmeta.ReadyCondition, Status: metav1.ConditionFalse, Reason: helmv2.UpgradeFailedReason, Message: "Forbidden: updates to statefulset spec for fields other than 'replicas'"},
	}

	t.Run("stalled release is remediated", func(t *testing.T) {
		service, release, statefulSet, pvc := remediationFixtures(immutableFailure, "2Gi")
		s := remediationScheme(t)
		c := fake.NewClientBuilder().WithScheme(s).WithObjects(service, release, statefulSet, pvc).Build()
		r := &ServiceReconciler{Client: c, Scheme: s}

		require.NoError(t, r.remediateStalledDatabaseRelease(ctx, service))

		err := c.Get(ctx, client.ObjectKeyFromObject(statefulSet), &appsv1.StatefulSet{})
		assert.True(t, kerrors.IsNotFound(err), "statefulset should be deleted")

		var grownPVC corev1.PersistentVolumeClaim
		require.NoError(t, c.Get(ctx, client.ObjectKeyFromObject(pvc), &grownPVC))
		assert.Equal(t, resource.MustParse("2Gi"), grownPVC.Spec.Resources.Requests[corev1.ResourceStorage])

		var patched helmv2.HelmRelease
		require.NoError(t, c.Get(ctx, client.ObjectKeyFromObject(release), &patched))
		requested := patched.Annotations[fluxmeta.ReconcileRequestAnnotation]
		assert.NotEmpty(t, requested)
		assert.Equal(t, requested, patched.Annotations[fluxmeta.ForceRequestAnnotation])
	})

	t.Run("healthy release is untouched", func(t *testing.T) {
		healthy := []metav1.Condition{{Type: fluxmeta.ReadyCondition, Status: metav1.ConditionTrue, Reason: "ReconciliationSucceeded"}}
		service, release, statefulSet, pvc := remediationFixtures(healthy, "2Gi")
		s := remediationScheme(t)
		c := fake.NewClientBuilder().WithScheme(s).WithObjects(service, release, statefulSet, pvc).Build()
		r := &ServiceReconciler{Client: c, Scheme: s}

		require.NoError(t, r.remediateStalledDatabaseRelease(ctx, service))

		require.NoError(t, c.Get(ctx, client.ObjectKeyFromObject(statefulSet), &appsv1.StatefulSet{}))
		var untouched corev1.PersistentVolumeClaim
		require.NoError(t, c.Get(ctx, client.ObjectKeyFromObject(pvc), &untouched))
		assert.Equal(t, resource.MustParse("1Gi"), untouched.Spec.Resources.Requests[corev1.ResourceStorage])
	})

	t.Run("unrelated failure is untouched", func(t *testing.T) {
		unrelated := []metav1.Condition{{Type: fluxmeta.ReadyCondition, Status: metav1.ConditionFalse, Reason: helmv2.UpgradeFailedReason, Message: "schema validation failed"}}
		service, release, statefulSet, _ := remediationFixtures(unrelated, "2Gi")
		s := remediationScheme(t)
		c := fake.NewClientBuilder().WithScheme(s).WithObjects(service, release, statefulSet).Build()
		r := &ServiceReconciler{Client: c, Scheme: s}

		require.NoError(t, r.remediateStalledDatabaseRelease(ctx, service))
		require.NoError(t, c.Get(ctx, client.ObjectKeyFromObject(statefulSet), &appsv1.StatefulSet{}))
	})

	t.Run("pvc is never shrunk", func(t *testing.T) {
		service, release, statefulSet, pvc := remediationFixtures(immutableFailure, "500Mi")
		s := remediationScheme(t)
		c := fake.NewClientBuilder().WithScheme(s).WithObjects(service, release, statefulSet, pvc).Build()
		r := &ServiceReconciler{Client: c, Scheme: s}

		require.NoError(t, r.remediateStalledDatabaseRelease(ctx, service))

		var untouched corev1.PersistentVolumeClaim
		require.NoError(t, c.Get(ctx, client.ObjectKeyFromObject(pvc), &untouched))
		assert.Equal(t, resource.MustParse("1Gi"), untouched.Spec.Resources.Requests[corev1.ResourceStorage])
	})

	t.Run("missing release is a no-op", func(t *testing.T) {
		service, _, _, _ := remediationFixtures(immutableFailure, "2Gi")
		s := remediationScheme(t)
		c := fake.NewClientBuilder().WithScheme(s).WithObjects(service).Build()
		r := &ServiceReconciler{Client: c, Scheme: s}

		require.NoError(t, r.remediateStalledDatabaseRelease(ctx, service))
	})
}
