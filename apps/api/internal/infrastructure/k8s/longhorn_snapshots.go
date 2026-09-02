package k8s

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/unbindapp/unbind-api/internal/common/log"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/wait"
)

const (
	longhornNamespace       = "longhorn-system"
	longhornCSIDriver       = "driver.longhorn.io"
	longhornVolumeLabel     = "longhornvolume"
	expansionSnapshotPrefix = "expand-"
	resizeCleanupTimeout    = 30 * time.Minute
	longhornBackendURL      = "http://longhorn-backend.longhorn-system:9500"
	longhornVolumeAttached  = "attached"
	longhornRequestTimeout  = 30 * time.Second
)

var (
	longhornSnapshotGVR = schema.GroupVersionResource{Group: "longhorn.io", Version: "v1beta2", Resource: "snapshots"}
	longhornHTTPClient  = &http.Client{Timeout: longhornRequestTimeout}
)

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

// Longhorn only prunes a removed snapshot behind the volume head during a purge, and nothing else triggers one
func (self *KubeClient) PurgeRemovedLonghornSnapshots(ctx context.Context) error {
	volumes, err := self.volumesWithRemovedSnapshots(ctx)
	if err != nil {
		return err
	}

	for _, volume := range volumes {
		state, err := self.longhornVolumeState(ctx, volume)
		if err != nil {
			log.Warnf("failed to read state of longhorn volume '%s': %v", volume, err)
			continue
		}
		if state != longhornVolumeAttached {
			continue
		}
		if err := self.purgeLonghornSnapshots(ctx, volume); err != nil {
			log.Warnf("failed to purge snapshots of longhorn volume '%s': %v", volume, err)
			continue
		}
		log.Infof("purging removed snapshots of longhorn volume '%s'", volume)
	}
	return nil
}

func (self *KubeClient) volumesWithRemovedSnapshots(ctx context.Context) ([]string, error) {
	snapshots, err := self.client.Resource(longhornSnapshotGVR).Namespace(longhornNamespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}

	var volumes []string
	for _, snapshot := range snapshots.Items {
		removed, _, _ := unstructured.NestedBool(snapshot.Object, "status", "markRemoved")
		volume, _, _ := unstructured.NestedString(snapshot.Object, "spec", "volume")
		if !removed || volume == "" || slices.Contains(volumes, volume) {
			continue
		}
		volumes = append(volumes, volume)
	}
	slices.Sort(volumes)
	return volumes, nil
}

func (self *KubeClient) longhornVolumeState(ctx context.Context, volume string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, self.longhornBackendURL+"/v1/volumes/"+volume, nil)
	if err != nil {
		return "", err
	}
	resp, err := longhornHTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status %d", resp.StatusCode)
	}

	var body struct {
		State string `json:"state"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", err
	}
	return body.State, nil
}

func (self *KubeClient) purgeLonghornSnapshots(ctx context.Context, volume string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, self.longhornBackendURL+"/v1/volumes/"+volume+"?action=snapshotPurge", strings.NewReader("{}"))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := longhornHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("unexpected status %d", resp.StatusCode)
	}
	return nil
}
