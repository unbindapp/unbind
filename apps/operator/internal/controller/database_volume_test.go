package controller

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes/scheme"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

func dataClaim(name, capacity string, labels map[string]string) *corev1.PersistentVolumeClaim {
	claim := &corev1.PersistentVolumeClaim{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "team", Labels: labels}}
	if capacity != "" {
		claim.Status.Capacity = corev1.ResourceList{corev1.ResourceStorage: resource.MustParse(capacity)}
	}
	return claim
}

func volumeReconciler(t *testing.T, objects ...client.Object) *ServiceReconciler {
	s := runtime.NewScheme()
	require.NoError(t, scheme.AddToScheme(s))
	require.NoError(t, v1.AddToScheme(s))
	return &ServiceReconciler{Client: fake.NewClientBuilder().WithScheme(s).WithObjects(objects...).Build(), Scheme: s}
}

func TestDataVolumeCapacity(t *testing.T) {
	replicas := int32(2)
	service := databaseService("postgres")
	service.Name = "pg"
	service.Namespace = "team"
	service.Spec.Config.Replicas = &replicas

	cases := map[string]struct {
		claims []client.Object
		want   string
	}{
		"no claims yet":                          {nil, ""},
		"claims not bound yet":                   {[]client.Object{dataClaim("pgdata-pg-0", "", nil)}, ""},
		"the smallest replica counts":            {[]client.Object{dataClaim("pgdata-pg-0", "20Gi", nil), dataClaim("pgdata-pg-1", "1Gi", nil)}, "1Gi"},
		"an unbound replica is skipped":          {[]client.Object{dataClaim("pgdata-pg-0", "20Gi", nil), dataClaim("pgdata-pg-1", "", nil)}, "20Gi"},
		"claims of other databases do not count": {[]client.Object{dataClaim("pgdata-other-0", "50Gi", nil)}, ""},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			capacity, err := volumeReconciler(t, tc.claims...).dataVolumeCapacity(context.Background(), service)
			require.NoError(t, err)
			assert.Equal(t, tc.want, capacity)
		})
	}
}

func TestServicesForClaim(t *testing.T) {
	labels := map[string]string{serviceLabel: "service-id"}
	database := databaseService("postgres")
	database.Name, database.Namespace, database.Spec.ServiceRef = "pg", "team", "service-id"
	sibling := databaseService("postgres")
	sibling.Name, sibling.Namespace, sibling.Spec.ServiceRef = "other-pg", "team", "other-id"
	otherNamespace := databaseService("postgres")
	otherNamespace.Name, otherNamespace.Namespace, otherNamespace.Spec.ServiceRef = "pg", "other", "service-id"
	r := volumeReconciler(t, database, sibling, otherNamespace)

	assert.Equal(t,
		[]reconcile.Request{{NamespacedName: types.NamespacedName{Namespace: "team", Name: "pg"}}},
		r.servicesForClaim(context.Background(), dataClaim("pgdata-pg-0", "1Gi", labels)),
	)
	assert.Empty(t, r.servicesForClaim(context.Background(), dataClaim("pgdata-pg-0", "1Gi", nil)))
}

func TestClaimCapacityChanged(t *testing.T) {
	labels := map[string]string{serviceLabel: "service-id"}

	assert.True(t, claimCapacityChanged.Update(event.UpdateEvent{
		ObjectOld: dataClaim("pgdata-pg-0", "1Gi", labels),
		ObjectNew: dataClaim("pgdata-pg-0", "30Gi", labels),
	}), "a finished resize")
	assert.True(t, claimCapacityChanged.Update(event.UpdateEvent{
		ObjectOld: dataClaim("pgdata-pg-0", "", labels),
		ObjectNew: dataClaim("pgdata-pg-0", "1Gi", labels),
	}), "a claim that just got bound")
	assert.False(t, claimCapacityChanged.Update(event.UpdateEvent{
		ObjectOld: dataClaim("pgdata-pg-0", "1Gi", labels),
		ObjectNew: dataClaim("pgdata-pg-0", "1Gi", labels),
	}), "an unrelated update")
	assert.False(t, claimCapacityChanged.Update(event.UpdateEvent{
		ObjectOld: dataClaim("data-0", "1Gi", nil),
		ObjectNew: dataClaim("data-0", "30Gi", nil),
	}), "a claim Unbind does not manage")
	assert.False(t, claimCapacityChanged.Create(event.CreateEvent{Object: dataClaim("pgdata-pg-0", "1Gi", labels)}))
}
