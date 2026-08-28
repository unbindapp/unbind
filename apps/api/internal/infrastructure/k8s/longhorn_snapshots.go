package k8s

import (
	"context"
	"strings"
	"time"

	"github.com/unbindapp/unbind-api/internal/common/log"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/wait"
)

const (
	longhornNamespace       = "longhorn-system"
	longhornCSIDriver       = "driver.longhorn.io"
	longhornVolumeLabel     = "longhornvolume"
	expansionSnapshotPrefix = "expand-"
	resizeCleanupTimeout    = 30 * time.Minute
)

var longhornSnapshotGVR = schema.GroupVersionResource{Group: "longhorn.io", Version: "v1beta2", Resource: "snapshots"}

func (self *KubeClient) cleanupExpansionSnapshotsAfterResize(namespace, pvcName string) {
	ctx, cancel := context.WithTimeout(context.Background(), resizeCleanupTimeout)
	defer cancel()

	err := wait.PollUntilContextTimeout(ctx, self.resizeCleanupPollInterval, resizeCleanupTimeout, true, func(ctx context.Context) (bool, error) {
		pvc, err := self.clientset.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, pvcName, metav1.GetOptions{})
		if err != nil {
			if errors.IsNotFound(err) {
				return false, err
			}
			return false, nil
		}

		capacity, hasCapacity := pvc.Status.Capacity[corev1.ResourceStorage]
		request, hasRequest := pvc.Spec.Resources.Requests[corev1.ResourceStorage]
		if !hasCapacity || !hasRequest || capacity.Cmp(request) < 0 {
			return false, nil
		}

		volumeName, err := self.longhornVolumeName(ctx, pvc.Spec.VolumeName)
		if err != nil {
			return false, nil
		}
		if volumeName == "" {
			return true, nil
		}

		if err := self.deleteExpansionSnapshots(ctx, volumeName); err != nil {
			log.Warnf("failed to delete expansion snapshots for volume '%s': %v", volumeName, err)
			return false, nil
		}
		return true, nil
	})
	if err != nil {
		log.Warnf("gave up cleaning up expansion snapshots for PVC '%s/%s': %v", namespace, pvcName, err)
	}
}

func (self *KubeClient) longhornVolumeName(ctx context.Context, pvName string) (string, error) {
	if pvName == "" {
		return "", nil
	}
	pv, err := self.clientset.CoreV1().PersistentVolumes().Get(ctx, pvName, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	if pv.Spec.CSI == nil || pv.Spec.CSI.Driver != longhornCSIDriver {
		return "", nil
	}
	return pv.Spec.CSI.VolumeHandle, nil
}

func (self *KubeClient) deleteExpansionSnapshots(ctx context.Context, volumeName string) error {
	snapshots, err := self.client.Resource(longhornSnapshotGVR).Namespace(longhornNamespace).
		List(ctx, metav1.ListOptions{LabelSelector: longhornVolumeLabel + "=" + volumeName})
	if err != nil {
		return err
	}

	for _, snapshot := range snapshots.Items {
		if !strings.HasPrefix(snapshot.GetName(), expansionSnapshotPrefix) {
			continue
		}
		if err := self.client.Resource(longhornSnapshotGVR).Namespace(longhornNamespace).
			Delete(ctx, snapshot.GetName(), metav1.DeleteOptions{}); err != nil && !errors.IsNotFound(err) {
			return err
		}
	}
	return nil
}
