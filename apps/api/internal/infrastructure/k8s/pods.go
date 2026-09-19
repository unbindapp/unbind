package k8s

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
)

// GetPodsByLabels returns pods matching the provided labels in a namespace. The
// replica views poll this every few seconds per open tab, so identical reads are
// served from a short-lived cache (see ttlCache).
func (k *KubeClient) GetPodsByLabels(ctx context.Context, namespace string, labels map[string]string, client kubernetes.Interface) (*corev1.PodList, error) {
	var labelSelectors []string
	for key, value := range labels {
		labelSelectors = append(labelSelectors, fmt.Sprintf("%s=%s", key, value))
	}
	sort.Strings(labelSelectors)
	labelSelector := strings.Join(labelSelectors, ",")

	fetch := func(ctx context.Context) (*corev1.PodList, error) {
		return client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
			LabelSelector: labelSelector,
		})
	}

	if !k.cacheable(client) {
		return fetch(ctx)
	}
	return cached(ctx, k.listCache, "pods|"+namespace+"|"+labelSelector, fetch, (*corev1.PodList).DeepCopy)
}

// RollingRestartPodsByLabel performs a rolling restart of all pods with a specific label
// regardless of whether they're part of Deployments, StatefulSets, or standalone pods.
func (k *KubeClient) RollingRestartPodsByLabel(
	ctx context.Context,
	namespace string,
	labelKey string,
	labelValue string,
	client kubernetes.Interface,
) error {
	// What this writes can change pods or claims, so the cached reads go with it.
	defer k.invalidateCache()

	labels := map[string]string{
		labelKey: labelValue,
	}

	pods, err := k.GetPodsByLabels(ctx, namespace, labels, client)
	if err != nil {
		return fmt.Errorf("failed to get pods with label %s=%s: %w", labelKey, labelValue, err)
	}

	// Group pods by owner
	podsByOwner := make(map[string][]corev1.Pod)
	standalonePods := make([]corev1.Pod, 0)

	for _, pod := range pods.Items {
		if len(pod.OwnerReferences) == 0 {
			standalonePods = append(standalonePods, pod)
			continue
		}

		// Get the top-level owner
		ownerRef := getTopLevelOwner(ctx, pod, client, namespace)
		if ownerRef != nil {
			key := fmt.Sprintf("%s/%s/%s", ownerRef.Kind, namespace, ownerRef.Name)
			podsByOwner[key] = append(podsByOwner[key], pod)
		} else {
			standalonePods = append(standalonePods, pod)
		}
	}

	// Restart workloads (Deployments, StatefulSets, etc.)
	for ownerKey := range podsByOwner {
		parts := strings.Split(ownerKey, "/")
		if len(parts) != 3 {
			continue
		}

		kind := parts[0]
		name := parts[2]

		switch kind {
		case "Deployment":
			if err := k.restartDeployment(ctx, namespace, name, client); err != nil {
				return fmt.Errorf("failed to restart Deployment %s: %w", name, err)
			}
		case "StatefulSet":
			if err := k.restartStatefulSet(ctx, namespace, name, client); err != nil {
				return fmt.Errorf("failed to restart StatefulSet %s: %w", name, err)
			}
		case "DaemonSet":
			if err := k.restartDaemonSet(ctx, namespace, name, client); err != nil {
				return fmt.Errorf("failed to restart DaemonSet %s: %w", name, err)
			}
		default:
			return fmt.Errorf("unsupported kind for rolling restart: %s", kind)
		}
	}

	// Restart standalone pods one by one
	for _, pod := range standalonePods {
		if err := k.deletePod(ctx, namespace, pod.Name, client); err != nil {
			return fmt.Errorf("failed to delete standalone pod %s: %w", pod.Name, err)
		}
		// Wait briefly before deleting the next pod
		time.Sleep(5 * time.Second)
	}

	return nil
}

// Helper function to get the top-level owner of a pod
func getTopLevelOwner(ctx context.Context, pod corev1.Pod, client kubernetes.Interface, namespace string) *metav1.OwnerReference {
	if len(pod.OwnerReferences) == 0 {
		return nil
	}

	ownerRef := pod.OwnerReferences[0]

	// Check if the owner is a ReplicaSet (which is typically owned by a Deployment)
	if ownerRef.Kind == "ReplicaSet" {
		replicaSet, err := client.AppsV1().ReplicaSets(namespace).Get(ctx, ownerRef.Name, metav1.GetOptions{})
		if err != nil {
			return &ownerRef
		}

		if len(replicaSet.OwnerReferences) > 0 {
			return &replicaSet.OwnerReferences[0]
		}
	}

	return &ownerRef
}

// restartPatch changes the pod template so the workload rolls. Nanoseconds keep two
// restarts within the same second from producing the same annotation, which is no restart.
func restartPatch(now time.Time) string {
	return fmt.Sprintf(`{"spec":{"template":{"metadata":{"annotations":{"kubectl.kubernetes.io/restartedAt":"%s"}}}}}`, now.Format(time.RFC3339Nano))
}

// Restart a Deployment by patching it with a restart annotation
func (k *KubeClient) restartDeployment(ctx context.Context, namespace, name string, client kubernetes.Interface) error {
	// Adding this annotation triggers pod restarts
	patchData := restartPatch(time.Now())

	_, err := client.AppsV1().Deployments(namespace).Patch(ctx, name, types.StrategicMergePatchType, []byte(patchData), metav1.PatchOptions{})
	return err
}

// Restart a StatefulSet by patching it with a restart annotation
func (k *KubeClient) restartStatefulSet(ctx context.Context, namespace, name string, client kubernetes.Interface) error {
	// Adding this annotation triggers pod restarts
	patchData := restartPatch(time.Now())

	_, err := client.AppsV1().StatefulSets(namespace).Patch(ctx, name, types.StrategicMergePatchType, []byte(patchData), metav1.PatchOptions{})
	return err
}

// Restart a DaemonSet by patching it with a restart annotation
func (k *KubeClient) restartDaemonSet(ctx context.Context, namespace, name string, client kubernetes.Interface) error {
	// Adding this annotation triggers pod restarts
	patchData := restartPatch(time.Now())

	_, err := client.AppsV1().DaemonSets(namespace).Patch(ctx, name, types.StrategicMergePatchType, []byte(patchData), metav1.PatchOptions{})
	return err
}

// Delete a standalone pod
func (k *KubeClient) deletePod(ctx context.Context, namespace, name string, client kubernetes.Interface) error {
	defer k.invalidateCache()

	return client.CoreV1().Pods(namespace).Delete(ctx, name, metav1.DeleteOptions{})
}

// DeleteStatefulSetsWithOrphanCascade deletes StatefulSets matching the label selector with orphan cascade
func (self *KubeClient) DeleteStatefulSetsWithOrphanCascade(ctx context.Context, namespace string, labels map[string]string, client kubernetes.Interface) error {
	defer self.invalidateCache()

	var labelSelectors []string
	for key, value := range labels {
		labelSelectors = append(labelSelectors, fmt.Sprintf("%s=%s", key, value))
	}
	labelSelector := strings.Join(labelSelectors, ",")

	statefulSets, err := client.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return fmt.Errorf("failed to list StatefulSets: %w", err)
	}

	for _, sts := range statefulSets.Items {
		err = client.AppsV1().StatefulSets(namespace).Delete(ctx, sts.Name, metav1.DeleteOptions{
			PropagationPolicy: new(metav1.DeletePropagationOrphan),
		})
		if err != nil {
			return fmt.Errorf("failed to delete StatefulSet %s: %w", sts.Name, err)
		}
	}

	return nil
}
