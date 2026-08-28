package k8s

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	"k8s.io/client-go/kubernetes/fake"
)

func longhornSnapshot(name, volume string) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "longhorn.io/v1beta2",
		"kind":       "Snapshot",
		"metadata": map[string]any{
			"name":      name,
			"namespace": longhornNamespace,
			"labels":    map[string]any{longhornVolumeLabel: volume},
		},
		"spec": map[string]any{"volume": volume},
	}}
}

func newSnapshotDynamicClient(objects ...runtime.Object) *dynamicfake.FakeDynamicClient {
	return dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), map[schema.GroupVersionResource]string{
		longhornSnapshotGVR: "SnapshotList",
	}, objects...)
}

func listSnapshotNames(t *testing.T, client *dynamicfake.FakeDynamicClient) []string {
	list, err := client.Resource(longhornSnapshotGVR).Namespace(longhornNamespace).List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)
	names := make([]string, 0, len(list.Items))
	for _, item := range list.Items {
		names = append(names, item.GetName())
	}
	slices.Sort(names)
	return names
}

func TestDeleteExpansionSnapshots(t *testing.T) {
	dynamicClient := newSnapshotDynamicClient(
		longhornSnapshot("expand-69793218560", "pvc-target"),
		longhornSnapshot("expand-107374182400", "pvc-target"),
		longhornSnapshot("user-snapshot", "pvc-target"),
		longhornSnapshot("expand-107374182400-other", "pvc-other"),
	)
	kubeClient := &KubeClient{client: dynamicClient}

	require.NoError(t, kubeClient.deleteExpansionSnapshots(context.Background(), "pvc-target"))

	assert.Equal(t, []string{"expand-107374182400-other", "user-snapshot"}, listSnapshotNames(t, dynamicClient))
}

func TestDeleteExpansionSnapshots_NoSnapshots(t *testing.T) {
	dynamicClient := newSnapshotDynamicClient()
	kubeClient := &KubeClient{client: dynamicClient}

	require.NoError(t, kubeClient.deleteExpansionSnapshots(context.Background(), "pvc-target"))
}

func resizedPVCFixtures(driver string) (*corev1.PersistentVolumeClaim, *corev1.PersistentVolume) {
	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{Name: "data-pvc", Namespace: "team-ns"},
		Spec: corev1.PersistentVolumeClaimSpec{
			VolumeName: "pvc-abc123",
			Resources: corev1.VolumeResourceRequirements{
				Requests: corev1.ResourceList{corev1.ResourceStorage: resource.MustParse("10Gi")},
			},
		},
		Status: corev1.PersistentVolumeClaimStatus{
			Capacity: corev1.ResourceList{corev1.ResourceStorage: resource.MustParse("10Gi")},
		},
	}
	pv := &corev1.PersistentVolume{
		ObjectMeta: metav1.ObjectMeta{Name: "pvc-abc123"},
		Spec: corev1.PersistentVolumeSpec{
			PersistentVolumeSource: corev1.PersistentVolumeSource{
				CSI: &corev1.CSIPersistentVolumeSource{Driver: driver, VolumeHandle: "pvc-abc123"},
			},
		},
	}
	return pvc, pv
}

func TestCleanupExpansionSnapshotsAfterResize(t *testing.T) {
	pvc, pv := resizedPVCFixtures(longhornCSIDriver)
	dynamicClient := newSnapshotDynamicClient(longhornSnapshot("expand-10737418240", "pvc-abc123"))
	kubeClient := &KubeClient{
		clientset:                 fake.NewSimpleClientset(pvc, pv),
		client:                    dynamicClient,
		resizeCleanupPollInterval: time.Millisecond,
	}

	kubeClient.cleanupExpansionSnapshotsAfterResize("team-ns", "data-pvc")

	assert.Empty(t, listSnapshotNames(t, dynamicClient))
}

func TestCleanupExpansionSnapshotsAfterResize_NonLonghornVolumeUntouched(t *testing.T) {
	pvc, pv := resizedPVCFixtures("ebs.csi.aws.com")
	dynamicClient := newSnapshotDynamicClient(longhornSnapshot("expand-10737418240", "pvc-abc123"))
	kubeClient := &KubeClient{
		clientset:                 fake.NewSimpleClientset(pvc, pv),
		client:                    dynamicClient,
		resizeCleanupPollInterval: time.Millisecond,
	}

	kubeClient.cleanupExpansionSnapshotsAfterResize("team-ns", "data-pvc")

	assert.Equal(t, []string{"expand-10737418240"}, listSnapshotNames(t, dynamicClient))
}

func TestCleanupExpansionSnapshotsAfterResize_WaitsForCapacity(t *testing.T) {
	pvc, pv := resizedPVCFixtures(longhornCSIDriver)
	pvc.Spec.Resources.Requests[corev1.ResourceStorage] = resource.MustParse("20Gi")
	clientset := fake.NewSimpleClientset(pvc, pv)
	dynamicClient := newSnapshotDynamicClient(longhornSnapshot("expand-21474836480", "pvc-abc123"))
	kubeClient := &KubeClient{
		clientset:                 clientset,
		client:                    dynamicClient,
		resizeCleanupPollInterval: time.Millisecond,
	}

	done := make(chan struct{})
	go func() {
		kubeClient.cleanupExpansionSnapshotsAfterResize("team-ns", "data-pvc")
		close(done)
	}()

	time.Sleep(20 * time.Millisecond)
	assert.Equal(t, []string{"expand-21474836480"}, listSnapshotNames(t, dynamicClient))

	grown := pvc.DeepCopy()
	grown.Status.Capacity[corev1.ResourceStorage] = resource.MustParse("20Gi")
	_, err := clientset.CoreV1().PersistentVolumeClaims("team-ns").Update(context.Background(), grown, metav1.UpdateOptions{})
	require.NoError(t, err)

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("cleanup did not finish after resize completed")
	}
	assert.Empty(t, listSnapshotNames(t, dynamicClient))
}
