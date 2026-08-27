package k8s

import (
	"context"
	"fmt"
	"time"

	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/kubernetes"
)

// a crash between delete and recreate leaves the PV self-describing via this annotation
const rebindTargetAnnotation = "unbind.unbind.app/rebind-target-claim"

const (
	rebindPollInterval = 250 * time.Millisecond
	rebindPollTimeout  = 60 * time.Second

	// past this the class is WaitForFirstConsumer and no amount of waiting resolves it
	bindPollInterval = 250 * time.Millisecond
	bindPollTimeout  = 10 * time.Second
)

// unbound claims (WaitForFirstConsumer) are skipped and picked up on the next reconcile
func (self *KubeClient) RetainVolumeForClaim(ctx context.Context, namespace string, pvcName string, client kubernetes.Interface) error {
	pvName, err := self.awaitClaimVolume(ctx, namespace, pvcName, client)
	if err != nil || pvName == "" {
		return err
	}
	return self.retainPersistentVolume(ctx, pvName)
}

func (self *KubeClient) awaitClaimVolume(ctx context.Context, namespace, pvcName string, client kubernetes.Interface) (string, error) {
	var pvName string
	err := wait.PollUntilContextTimeout(ctx, bindPollInterval, bindPollTimeout, true, func(ctx context.Context) (bool, error) {
		pvc, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, pvcName, metav1.GetOptions{})
		if err != nil {
			if errors.IsNotFound(err) {
				return false, errdefs.NewCustomError(errdefs.ErrTypeNotFound, fmt.Sprintf("PersistentVolumeClaim '%s' not found", pvcName))
			}
			return false, fmt.Errorf("failed to get PersistentVolumeClaim '%s': %w", pvcName, err)
		}
		pvName = pvc.Spec.VolumeName
		return pvName != "", nil
	})
	if err != nil && !wait.Interrupted(err) {
		return "", err
	}
	return pvName, nil
}

func (self *KubeClient) retainPersistentVolume(ctx context.Context, pvName string) error {
	volumes := self.GetInternalClient().CoreV1().PersistentVolumes()
	pv, err := volumes.Get(ctx, pvName, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get PersistentVolume '%s': %w", pvName, err)
	}
	if pv.Spec.PersistentVolumeReclaimPolicy == corev1.PersistentVolumeReclaimRetain {
		return nil
	}

	pv.Spec.PersistentVolumeReclaimPolicy = corev1.PersistentVolumeReclaimRetain
	if _, err := volumes.Update(ctx, pv, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("failed to retain PersistentVolume '%s': %w", pvName, err)
	}
	return nil
}

// uid and resourceVersion must stay empty or the binding is rejected
// (kubernetes.io/docs/concepts/storage/persistent-volumes "Reserving a PersistentVolume")
func (self *KubeClient) reservePersistentVolume(ctx context.Context, pvName, namespace, claimName string) error {
	volumes := self.GetInternalClient().CoreV1().PersistentVolumes()
	pv, err := volumes.Get(ctx, pvName, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get PersistentVolume '%s': %w", pvName, err)
	}

	pv.Spec.ClaimRef = &corev1.ObjectReference{
		Kind:       "PersistentVolumeClaim",
		APIVersion: "v1",
		Namespace:  namespace,
		Name:       claimName,
	}
	if _, err := volumes.Update(ctx, pv, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("failed to reserve PersistentVolume '%s' for claim '%s': %w", pvName, claimName, err)
	}
	return nil
}

func (self *KubeClient) annotateRebindTarget(ctx context.Context, pvName, claimName string) error {
	volumes := self.GetInternalClient().CoreV1().PersistentVolumes()
	pv, err := volumes.Get(ctx, pvName, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get PersistentVolume '%s': %w", pvName, err)
	}
	if pv.Annotations == nil {
		pv.Annotations = map[string]string{}
	}
	pv.Annotations[rebindTargetAnnotation] = claimName

	if _, err := volumes.Update(ctx, pv, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("failed to annotate PersistentVolume '%s': %w", pvName, err)
	}
	return nil
}

// RebindPersistentVolumeClaim renames a claim without moving data: retain the PV, delete the
// claim, reserve the PV for the new name, recreate.
func (self *KubeClient) RebindPersistentVolumeClaim(ctx context.Context, namespace, fromName, toName string, client kubernetes.Interface) (*models.PVCInfo, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace cannot be empty")
	}
	if fromName == "" || toName == "" {
		return nil, fmt.Errorf("both claim names must be provided")
	}
	if fromName == toName {
		return self.GetPersistentVolumeClaim(ctx, namespace, fromName, client)
	}

	claims := client.CoreV1().PersistentVolumeClaims(namespace)
	from, err := claims.Get(ctx, fromName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, fmt.Sprintf("PersistentVolumeClaim '%s' not found", fromName))
		}
		return nil, fmt.Errorf("failed to get PersistentVolumeClaim '%s': %w", fromName, err)
	}
	if len(from.OwnerReferences) > 0 {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("Volume '%s' is owned by another resource and cannot be moved", fromName))
	}
	if from.Status.Phase != corev1.ClaimBound || from.Spec.VolumeName == "" {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("Volume '%s' is not bound yet", fromName))
	}

	pods, err := self.GetPodsUsingPVC(ctx, namespace, fromName, client)
	if err != nil {
		return nil, err
	}
	if blocking := mountBlockingPods(pods); len(blocking) > 0 {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("Volume '%s' is still mounted by %d pod(s)", fromName, len(blocking)))
	}

	_, err = claims.Get(ctx, toName, metav1.GetOptions{})
	if err == nil {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("A volume named '%s' already exists", toName))
	}
	if !errors.IsNotFound(err) {
		return nil, fmt.Errorf("failed to check for PersistentVolumeClaim '%s': %w", toName, err)
	}

	pvName := from.Spec.VolumeName
	if err := self.retainPersistentVolume(ctx, pvName); err != nil {
		return nil, err
	}
	if err := self.annotateRebindTarget(ctx, pvName, toName); err != nil {
		return nil, err
	}

	to := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      toName,
			Namespace: namespace,
			Labels:    from.Labels,
		},
		Spec: corev1.PersistentVolumeClaimSpec{
			AccessModes:      from.Spec.AccessModes,
			Resources:        from.Spec.Resources,
			StorageClassName: from.Spec.StorageClassName,
			VolumeMode:       from.Spec.VolumeMode,
			VolumeName:       pvName,
		},
	}

	if err := claims.Delete(ctx, fromName, metav1.DeleteOptions{}); err != nil && !errors.IsNotFound(err) {
		return nil, fmt.Errorf("failed to delete PersistentVolumeClaim '%s': %w", fromName, err)
	}
	if err := self.waitForClaimGone(ctx, namespace, fromName, client); err != nil {
		return nil, err
	}

	if err := self.reservePersistentVolume(ctx, pvName, namespace, toName); err != nil {
		return nil, err
	}

	if _, err := claims.Create(ctx, to, metav1.CreateOptions{}); err != nil {
		return nil, fmt.Errorf("failed to create PersistentVolumeClaim '%s': %w", toName, err)
	}
	if err := self.waitForClaimBound(ctx, namespace, toName, client); err != nil {
		return nil, err
	}

	return self.GetPersistentVolumeClaim(ctx, namespace, toName, client)
}

func (self *KubeClient) waitForClaimGone(ctx context.Context, namespace, pvcName string, client kubernetes.Interface) error {
	err := wait.PollUntilContextTimeout(ctx, rebindPollInterval, rebindPollTimeout, true, func(ctx context.Context) (bool, error) {
		_, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, pvcName, metav1.GetOptions{})
		if errors.IsNotFound(err) {
			return true, nil
		}
		return false, nil
	})
	if err != nil {
		return fmt.Errorf("timed out waiting for PersistentVolumeClaim '%s' to be deleted: %w", pvcName, err)
	}
	return nil
}

func (self *KubeClient) waitForClaimBound(ctx context.Context, namespace, pvcName string, client kubernetes.Interface) error {
	err := wait.PollUntilContextTimeout(ctx, rebindPollInterval, rebindPollTimeout, true, func(ctx context.Context) (bool, error) {
		pvc, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, pvcName, metav1.GetOptions{})
		if err != nil {
			return false, nil
		}
		return pvc.Status.Phase == corev1.ClaimBound, nil
	})
	if err != nil {
		return fmt.Errorf("timed out waiting for PersistentVolumeClaim '%s' to bind: %w", pvcName, err)
	}
	return nil
}
