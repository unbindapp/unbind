package k8s

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	mocks_repositories "github.com/unbindapp/unbind-api/mocks/repositories"
	mocks_service_repo "github.com/unbindapp/unbind-api/mocks/repository/service"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"
)

const (
	rebindNamespace = "team-ns"
	rebindVolume    = "pvc-9f8e7d6c"
)

// the fake clientset runs no binding controller, so claims come pre-bound
func boundClaim(name string) *corev1.PersistentVolumeClaim {
	return &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: rebindNamespace,
			Labels:    map[string]string{teamLabel: "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0"},
		},
		Spec: corev1.PersistentVolumeClaimSpec{
			AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
			Resources: corev1.VolumeResourceRequirements{
				Requests: corev1.ResourceList{corev1.ResourceStorage: resource.MustParse("10Gi")},
			},
			VolumeName: rebindVolume,
		},
		Status: corev1.PersistentVolumeClaimStatus{
			Phase:    corev1.ClaimBound,
			Capacity: corev1.ResourceList{corev1.ResourceStorage: resource.MustParse("10Gi")},
		},
	}
}

func rebindFixture(t *testing.T, objects ...runtime.Object) (*KubeClient, *fake.Clientset) {
	t.Helper()

	pv := &corev1.PersistentVolume{
		ObjectMeta: metav1.ObjectMeta{Name: rebindVolume},
		Spec: corev1.PersistentVolumeSpec{
			PersistentVolumeReclaimPolicy: corev1.PersistentVolumeReclaimDelete,
			ClaimRef: &corev1.ObjectReference{
				Namespace: rebindNamespace,
				Name:      "old-claim",
				UID:       "stale-uid",
			},
		},
	}

	client := fake.NewSimpleClientset(append(objects, pv)...)
	client.PrependReactor("create", "persistentvolumeclaims", func(action k8stesting.Action) (bool, runtime.Object, error) {
		pvc := action.(k8stesting.CreateAction).GetObject().(*corev1.PersistentVolumeClaim)
		pvc.Status.Phase = corev1.ClaimBound
		pvc.Status.Capacity = pvc.Spec.Resources.Requests
		return false, pvc, nil
	})

	repo := mocks_repositories.NewRepositoriesMock(t)
	serviceRepo := mocks_service_repo.NewServiceRepositoryMock(t)
	serviceRepo.EXPECT().GetServicesUsingPVC(mock.Anything, mock.Anything).Return(nil, nil).Maybe()
	repo.EXPECT().Service().Return(serviceRepo).Maybe()

	return &KubeClient{clientset: client, repo: repo}, client
}

func TestRebindPersistentVolumeClaim(t *testing.T) {
	kube, client := rebindFixture(t, boundClaim("my-volume-abc123"))

	_, err := kube.RebindPersistentVolumeClaim(context.Background(), rebindNamespace, "my-volume-abc123", "pgdata-my-db-0", client)
	require.NoError(t, err)

	_, err = client.CoreV1().PersistentVolumeClaims(rebindNamespace).Get(context.Background(), "my-volume-abc123", metav1.GetOptions{})
	assert.Error(t, err, "the old claim should be gone")

	moved, err := client.CoreV1().PersistentVolumeClaims(rebindNamespace).Get(context.Background(), "pgdata-my-db-0", metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, rebindVolume, moved.Spec.VolumeName, "the new claim must keep the same volume")
	assert.Equal(t, resource.MustParse("10Gi"), moved.Spec.Resources.Requests[corev1.ResourceStorage])

	pv, err := client.CoreV1().PersistentVolumes().Get(context.Background(), rebindVolume, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, corev1.PersistentVolumeReclaimRetain, pv.Spec.PersistentVolumeReclaimPolicy, "deleting the claim must not destroy the data")
	assert.Equal(t, "pgdata-my-db-0", pv.Spec.ClaimRef.Name)
	assert.Empty(t, pv.Spec.ClaimRef.UID, "a reservation must not carry the previous claim's uid")
	assert.Equal(t, "pgdata-my-db-0", pv.Annotations[rebindTargetAnnotation])
}

func TestRebindPersistentVolumeClaimRefusesLiveVolume(t *testing.T) {
	claim := boundClaim("my-volume-abc123")
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "consumer", Namespace: rebindNamespace},
		Spec: corev1.PodSpec{
			Volumes: []corev1.Volume{{
				Name: "data",
				VolumeSource: corev1.VolumeSource{
					PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{ClaimName: claim.Name},
				},
			}},
		},
		Status: corev1.PodStatus{Phase: corev1.PodRunning},
	}
	kube, client := rebindFixture(t, claim, pod)

	_, err := kube.RebindPersistentVolumeClaim(context.Background(), rebindNamespace, claim.Name, "pgdata-my-db-0", client)
	assert.ErrorContains(t, err, "still mounted")

	_, err = client.CoreV1().PersistentVolumeClaims(rebindNamespace).Get(context.Background(), claim.Name, metav1.GetOptions{})
	assert.NoError(t, err, "a refused rebind must leave the claim alone")
}

func TestRebindPersistentVolumeClaimRefusesExistingTarget(t *testing.T) {
	kube, client := rebindFixture(t, boundClaim("my-volume-abc123"), boundClaim("pgdata-my-db-0"))

	_, err := kube.RebindPersistentVolumeClaim(context.Background(), rebindNamespace, "my-volume-abc123", "pgdata-my-db-0", client)
	assert.ErrorContains(t, err, "already exists")
}

func TestRetainVolumeForClaim(t *testing.T) {
	kube, client := rebindFixture(t, boundClaim("my-volume-abc123"))

	require.NoError(t, kube.RetainVolumeForClaim(context.Background(), rebindNamespace, "my-volume-abc123", client))

	pv, err := client.CoreV1().PersistentVolumes().Get(context.Background(), rebindVolume, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, corev1.PersistentVolumeReclaimRetain, pv.Spec.PersistentVolumeReclaimPolicy)
}

// a just-created claim is unbound; retention must wait, not silently leave Delete in place
func TestRetainVolumeForClaimWaitsForBinding(t *testing.T) {
	unbound := boundClaim("my-volume-abc123")
	unbound.Spec.VolumeName = ""
	unbound.Status.Phase = corev1.ClaimPending

	kube, client := rebindFixture(t, unbound)

	bind := make(chan struct{})
	go func() {
		defer close(bind)
		pvc, err := client.CoreV1().PersistentVolumeClaims(rebindNamespace).Get(context.Background(), "my-volume-abc123", metav1.GetOptions{})
		if err != nil {
			return
		}
		pvc.Spec.VolumeName = rebindVolume
		pvc.Status.Phase = corev1.ClaimBound
		_, _ = client.CoreV1().PersistentVolumeClaims(rebindNamespace).Update(context.Background(), pvc, metav1.UpdateOptions{})
	}()
	<-bind

	require.NoError(t, kube.RetainVolumeForClaim(context.Background(), rebindNamespace, "my-volume-abc123", client))

	pv, err := client.CoreV1().PersistentVolumes().Get(context.Background(), rebindVolume, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, corev1.PersistentVolumeReclaimRetain, pv.Spec.PersistentVolumeReclaimPolicy)
}

// WaitForFirstConsumer never binds here; not an error, the next reconcile picks it up
func TestRetainVolumeForClaimToleratesUnboundClaim(t *testing.T) {
	unbound := boundClaim("my-volume-abc123")
	unbound.Spec.VolumeName = ""
	unbound.Status.Phase = corev1.ClaimPending

	kube, client := rebindFixture(t, unbound)

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	assert.NoError(t, kube.RetainVolumeForClaim(ctx, rebindNamespace, "my-volume-abc123", client))

	pv, err := client.CoreV1().PersistentVolumes().Get(context.Background(), rebindVolume, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, corev1.PersistentVolumeReclaimDelete, pv.Spec.PersistentVolumeReclaimPolicy)
}

func TestSetPersistentVolumeClaimService(t *testing.T) {
	kube, client := rebindFixture(t, boundClaim("my-volume-abc123"))
	ctx := context.Background()

	serviceID := mustParseUUID(t, "11111111-2222-3333-4444-555555555555")
	require.NoError(t, kube.SetPersistentVolumeClaimService(ctx, rebindNamespace, "my-volume-abc123", &serviceID, client))

	pvc, err := client.CoreV1().PersistentVolumeClaims(rebindNamespace).Get(ctx, "my-volume-abc123", metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, serviceID.String(), pvc.Labels[serviceLabel])

	require.NoError(t, kube.SetPersistentVolumeClaimService(ctx, rebindNamespace, "my-volume-abc123", nil, client))

	pvc, err = client.CoreV1().PersistentVolumeClaims(rebindNamespace).Get(ctx, "my-volume-abc123", metav1.GetOptions{})
	require.NoError(t, err)
	assert.NotContains(t, pvc.Labels, serviceLabel)

	assert.NoError(t, kube.SetPersistentVolumeClaimService(ctx, rebindNamespace, "gone", nil, client))
}

// deleting the volume itself must not leave an orphaned Released PV behind
func TestDeletePersistentVolumeClaimReleasesRetention(t *testing.T) {
	kube, client := rebindFixture(t, boundClaim("my-volume-abc123"))

	pv, err := client.CoreV1().PersistentVolumes().Get(context.Background(), rebindVolume, metav1.GetOptions{})
	require.NoError(t, err)
	pv.Spec.PersistentVolumeReclaimPolicy = corev1.PersistentVolumeReclaimRetain
	pv.Spec.ClaimRef = &corev1.ObjectReference{Namespace: rebindNamespace, Name: "my-volume-abc123"}
	_, err = client.CoreV1().PersistentVolumes().Update(context.Background(), pv, metav1.UpdateOptions{})
	require.NoError(t, err)

	require.NoError(t, kube.DeletePersistentVolumeClaim(context.Background(), rebindNamespace, "my-volume-abc123", client))

	pv, err = client.CoreV1().PersistentVolumes().Get(context.Background(), rebindVolume, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, corev1.PersistentVolumeReclaimDelete, pv.Spec.PersistentVolumeReclaimPolicy)
}

func mustParseUUID(t *testing.T, value string) uuid.UUID {
	t.Helper()
	parsed, err := uuid.Parse(value)
	require.NoError(t, err)
	return parsed
}
