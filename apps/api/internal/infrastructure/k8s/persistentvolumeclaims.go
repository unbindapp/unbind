package k8s

import (
	"context"
	"fmt"
	"maps"
	"math"
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
)

const (
	teamLabel        = "unbind-team"
	projectLabel     = "unbind-project"
	environmentLabel = "unbind-environment"
	serviceLabel     = "unbind-service"
	displayNameLabel = "pvc-display-name"
)

// CreatePersistentVolumeClaim creates a new PersistentVolumeClaim in the specified namespace.
func (self *KubeClient) CreatePersistentVolumeClaim(
	ctx context.Context,
	namespace string,
	pvcName string,
	displayName string,
	labels map[string]string,
	storageRequest string,
	accessModes []corev1.PersistentVolumeAccessMode,
	storageClassName *string,
	client kubernetes.Interface,
) (*models.PVCInfo, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace cannot be empty")
	}
	if pvcName == "" {
		return nil, fmt.Errorf("pvcName cannot be empty")
	}
	if storageRequest == "" {
		return nil, fmt.Errorf("storageRequest cannot be empty")
	}
	if len(accessModes) == 0 {
		return nil, fmt.Errorf("at least one accessMode must be provided")
	}

	storageQuantity, err := resource.ParseQuantity(storageRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to parse storageRequest '%s': %w", storageRequest, err)
	}

	pvcLabels := maps.Clone(labels)
	if pvcLabels == nil {
		pvcLabels = map[string]string{}
	}
	pvcLabels[displayNameLabel] = displayName

	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      pvcName,
			Namespace: namespace,
			Labels:    pvcLabels,
		},
		Spec: corev1.PersistentVolumeClaimSpec{
			AccessModes: accessModes,
			Resources: corev1.VolumeResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceStorage: storageQuantity,
				},
			},
		},
	}

	if storageClassName != nil && *storageClassName != "" {
		pvc.Spec.StorageClassName = storageClassName
	}

	_, err = client.CoreV1().PersistentVolumeClaims(namespace).Create(ctx, pvc, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to create PersistentVolumeClaim '%s' in namespace '%s': %w", pvcName, namespace, err)
	}

	// Return the created PVC info using GetPersistentVolumeClaim
	return self.GetPersistentVolumeClaim(ctx, namespace, pvcName, client)
}

// never resizes an existing claim; UpdatePersistentVolumeClaim owns that
func (self *KubeClient) EnsurePersistentVolumeClaim(
	ctx context.Context,
	namespace string,
	pvcName string,
	displayName string,
	labels map[string]string,
	storageRequest string,
	accessModes []corev1.PersistentVolumeAccessMode,
	storageClassName *string,
	client kubernetes.Interface,
) (*models.PVCInfo, error) {
	_, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, pvcName, metav1.GetOptions{})
	if err == nil {
		return self.GetPersistentVolumeClaim(ctx, namespace, pvcName, client)
	}
	if !errors.IsNotFound(err) {
		return nil, fmt.Errorf("failed to get PersistentVolumeClaim '%s' in namespace '%s': %w", pvcName, namespace, err)
	}

	return self.CreatePersistentVolumeClaim(ctx, namespace, pvcName, displayName, labels, storageRequest, accessModes, storageClassName, client)
}

// nil serviceID releases the claim
func (self *KubeClient) SetPersistentVolumeClaimService(ctx context.Context, namespace, pvcName string, serviceID *uuid.UUID, client kubernetes.Interface) error {
	pvc, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, pvcName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) && serviceID == nil {
			return nil
		}
		if errors.IsNotFound(err) {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, fmt.Sprintf("PersistentVolumeClaim '%s' not found", pvcName))
		}
		return fmt.Errorf("failed to get PersistentVolumeClaim '%s': %w", pvcName, err)
	}

	if pvc.Labels == nil {
		pvc.Labels = map[string]string{}
	}
	current, bound := pvc.Labels[serviceLabel]
	switch {
	case serviceID == nil && !bound:
		return nil
	case serviceID == nil:
		delete(pvc.Labels, serviceLabel)
	case current == serviceID.String():
		return nil
	default:
		pvc.Labels[serviceLabel] = serviceID.String()
	}

	if _, err := client.CoreV1().PersistentVolumeClaims(namespace).Update(ctx, pvc, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("failed to update labels on PersistentVolumeClaim '%s': %w", pvcName, err)
	}
	return nil
}

// UpdatePersistentVolumeClaim updates an existing PersistentVolumeClaim with new parameters (size, name)
func (self *KubeClient) UpdatePersistentVolumeClaim(
	ctx context.Context,
	namespace string,
	pvcName string,
	newSize *string,
	client kubernetes.Interface,
) (*models.PVCInfo, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace cannot be empty")
	}
	if pvcName == "" {
		return nil, fmt.Errorf("pvcName cannot be empty")
	}

	// Get the existing PVC
	pvc, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, pvcName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, fmt.Sprintf("PersistentVolumeClaim '%s' not found", pvcName))
		}
		return nil, fmt.Errorf("failed to get PersistentVolumeClaim '%s' in namespace '%s': %w", pvcName, namespace, err)
	}

	// Update the PVC size if provided
	if newSize != nil {
		newStorageQuantity, err := resource.ParseQuantity(*newSize)
		if err != nil {
			return nil, fmt.Errorf("failed to parse newSize '%s': %w", *newSize, err)
		}
		pvc.Spec.Resources.Requests[corev1.ResourceStorage] = newStorageQuantity
	}

	// Update the PVC in Kubernetes
	_, err = client.CoreV1().PersistentVolumeClaims(namespace).Update(ctx, pvc, metav1.UpdateOptions{})
	if err != nil {
		if isRejectedByAPIServer(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("Failed to resize PersistentVolumeClaim '%s': %s", pvcName, err.Error()))
		}
		return nil, fmt.Errorf("failed to update PersistentVolumeClaim '%s' in namespace '%s': %w", pvcName, namespace, err)
	}
	// Return the updated PVC info using GetPersistentVolumeClaim
	return self.GetPersistentVolumeClaim(ctx, namespace, pvcName, client)
}

// GetPersistentVolumeClaim retrieves a specific PersistentVolumeClaim by its name and namespace.
// resolvePVCServiceBinding resolves which service (if any) a PVC belongs to via
// its service-id label, falling back to a DB lookup of services referencing the
// PVC. It returns the bound service ID and whether that service is a database.
// A nil service ID means the PVC is unbound; parse failures are logged and
// treated as unbound, while DB errors are returned for the caller to handle.
func (self *KubeClient) resolvePVCServiceBinding(ctx context.Context, pvcName string, pvcLabels map[string]string) (boundToServiceID *uuid.UUID, isDatabase bool, err error) {
	serviceIDStr := pvcLabels[serviceLabel]
	if serviceIDStr == "" {
		services, err := self.repo.Service().GetServicesUsingPVC(ctx, pvcName)
		if err != nil {
			return nil, false, fmt.Errorf("failed to get services using PVC '%s': %w", pvcName, err)
		}
		if len(services) == 0 {
			return nil, false, nil
		}
		return &services[0].ID, services[0].Type == schema.ServiceTypeDatabase, nil
	}

	serviceID, err := uuid.Parse(serviceIDStr)
	if err != nil {
		log.Errorf("invalid service ID in PVC label '%s': %v", pvcName, err)
		return nil, false, nil
	}

	service, err := self.repo.Service().GetByID(ctx, serviceID)
	if err != nil && !ent.IsNotFound(err) {
		return nil, false, fmt.Errorf("failed to get service '%s': %w", serviceIDStr, err)
	}
	if service == nil {
		return nil, false, nil
	}
	return &service.ID, service.Type == schema.ServiceTypeDatabase, nil
}

// pvcBinding describes which service owns a PVC and the lifecycle state of its mounts.
type pvcBinding struct {
	ServiceID   *uuid.UUID
	IsDatabase  bool
	IsAttaching bool
	IsDetaching bool
	InUseByPods bool
}

// resolvePVCBinding determines PVC ownership and mount state. Ownership comes
// from the PVC label or the DB; a pod's service label is only trusted if that
// service still exists. Pods otherwise just signal whether mounts are still
// physically live, so a volume whose service was deleted reports as detaching
// while its old pods terminate instead of appearing mounted.
func (self *KubeClient) resolvePVCBinding(ctx context.Context, pvcName string, pvcLabels map[string]string, pods []corev1.Pod) (*pvcBinding, error) {
	serviceID, isDatabase, err := self.resolvePVCServiceBinding(ctx, pvcName, pvcLabels)
	if err != nil {
		return nil, err
	}

	blockingPods := mountBlockingPods(pods)

	if serviceID == nil {
		for _, pod := range blockingPods {
			podServiceID, err := uuid.Parse(pod.GetLabels()[serviceLabel])
			if err != nil {
				continue
			}
			service, err := self.repo.Service().GetByID(ctx, podServiceID)
			if err != nil && !ent.IsNotFound(err) {
				return nil, fmt.Errorf("failed to get service '%s': %w", podServiceID, err)
			}
			if service != nil {
				serviceID = &service.ID
				isDatabase = service.Type == schema.ServiceTypeDatabase
				break
			}
		}
	}

	return &pvcBinding{
		ServiceID:   serviceID,
		IsDatabase:  isDatabase,
		IsAttaching: serviceID != nil && !anyPodRunning(pods),
		IsDetaching: serviceID == nil && len(blockingPods) > 0,
		InUseByPods: len(blockingPods) > 0,
	}, nil
}

// mountBlockingPods filters out pods that have finished (Succeeded or Failed) —
// the kubelet has already unmounted their volumes, so they no longer keep a PVC in use.
func mountBlockingPods(pods []corev1.Pod) []corev1.Pod {
	var blocking []corev1.Pod
	for _, pod := range pods {
		if pod.Status.Phase != corev1.PodSucceeded && pod.Status.Phase != corev1.PodFailed {
			blocking = append(blocking, pod)
		}
	}
	return blocking
}

func (self *KubeClient) GetPersistentVolumeClaim(ctx context.Context, namespace string, pvcName string, client kubernetes.Interface) (*models.PVCInfo, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace cannot be empty")
	}
	if pvcName == "" {
		return nil, fmt.Errorf("pvcName cannot be empty")
	}

	pvc, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, pvcName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, fmt.Sprintf("PersistentVolumeClaim '%s' not found", pvcName))
		}
		return nil, fmt.Errorf("failed to get PersistentVolumeClaim '%s' in namespace '%s': %w", pvcName, namespace, err)
	}

	pods, err := self.GetPodsUsingPVC(ctx, pvc.Namespace, pvc.Name, client)
	if err != nil {
		return nil, fmt.Errorf("failed to get pods using PVC '%s': %w", pvcName, err)
	}

	info, err := self.buildPVCInfo(ctx, pvc, pods)
	if err != nil {
		return nil, err
	}
	if info == nil {
		return nil, fmt.Errorf("PVC '%s' does not have required team label", pvcName)
	}
	return info, nil
}

// nil result means no valid unbind-team label, so the claim is not ours
func (self *KubeClient) buildPVCInfo(ctx context.Context, pvc *corev1.PersistentVolumeClaim, pods []corev1.Pod) (*models.PVCInfo, error) {
	pvcLabels := pvc.GetLabels()
	teamID, err := uuid.Parse(pvcLabels[teamLabel])
	if err != nil {
		return nil, nil
	}

	var capacityBytes, requestBytes int64
	if capacity, ok := pvc.Status.Capacity[corev1.ResourceStorage]; ok {
		capacityBytes = capacity.Value()
	}
	if request, ok := pvc.Spec.Resources.Requests[corev1.ResourceStorage]; ok {
		requestBytes = request.Value()
	}

	reportedBytes := capacityBytes
	if capacityBytes == 0 {
		reportedBytes = requestBytes
	}

	capacityGB := bytesToGB(reportedBytes)
	requestedGB := bytesToGB(requestBytes)

	binding, err := self.resolvePVCBinding(ctx, pvc.Name, pvcLabels, pods)
	if err != nil {
		return nil, err
	}

	projectID := parseOptionalUUID(pvcLabels[projectLabel])
	environmentID := parseOptionalUUID(pvcLabels[environmentLabel])

	// A PVC with a deletion timestamp is terminating — kubernetes removes the
	// object asynchronously once its finalizers are cleared.
	isDeleting := pvc.DeletionTimestamp != nil
	canDelete := len(pvc.OwnerReferences) == 0 && binding.ServiceID == nil && !binding.InUseByPods && !isDeleting

	pvcType := models.PvcScopeTeam
	if projectID != nil && environmentID != nil {
		pvcType = models.PvcScopeEnvironment
	} else if projectID != nil {
		pvcType = models.PvcScopeProject
	}

	isPendingResize, err := self.isPendingResize(ctx, binding, capacityBytes, requestBytes)
	if err != nil {
		return nil, err
	}

	return &models.PVCInfo{
		ID:                 pvc.Name,
		Type:               pvcType,
		IsPendingResize:    isPendingResize,
		CapacityGB:         capacityGB,
		RequestedGB:        requestedGB,
		TeamID:             teamID,
		ProjectID:          projectID,
		EnvironmentID:      environmentID,
		MountedOnServiceID: binding.ServiceID,
		Status:             models.PersistentVolumeClaimPhase(pvc.Status.Phase),
		IsDatabase:         binding.IsDatabase,
		IsAvailable:        canDelete,
		IsDeleting:         isDeleting,
		IsAttaching:        binding.IsAttaching,
		IsDetaching:        binding.IsDetaching,
		CanDelete:          canDelete,
		CreatedAt:          pvc.CreationTimestamp.Time,
	}, nil
}

// operator-owned database volumes only get their request bumped once the operator syncs, so
// the service config is the earlier resize signal for those
func (self *KubeClient) isPendingResize(ctx context.Context, binding *pvcBinding, capacityBytes, requestBytes int64) (bool, error) {
	if capacityBytes == 0 {
		return false, nil
	}
	if requestBytes > capacityBytes {
		return true, nil
	}
	if !binding.IsDatabase || binding.ServiceID == nil {
		return false, nil
	}

	dbConfig, volumes, err := self.repo.Service().GetDatabaseStorageConfig(ctx, *binding.ServiceID)
	if err != nil {
		if ent.IsNotFound(err) {
			return false, nil
		}
		return false, fmt.Errorf("failed to get database config for service '%s': %w", binding.ServiceID, err)
	}
	if dbConfig == nil || dbConfig.StorageSize == "" || len(volumes) > 0 {
		return false, nil
	}

	qty, err := utils.ParseStorageQuantity(dbConfig.StorageSize)
	if err != nil {
		// a corrupt stored size must not take down the whole PVC view
		log.Errorf("failed to parse storage size '%s' for service '%s': %v", dbConfig.StorageSize, binding.ServiceID, err)
		return false, nil
	}
	return qty.Value() > capacityBytes, nil
}

func bytesToGB(value int64) float64 {
	return math.Round(float64(value)/(1024*1024*1024)*100) / 100
}

func parseOptionalUUID(value string) *uuid.UUID {
	parsed, err := uuid.Parse(value)
	if err != nil {
		return nil
	}
	return &parsed
}

// anyPodRunning reports whether any of the pods referencing a PVC is actually
// running (and has therefore mounted the volume).
func anyPodRunning(pods []corev1.Pod) bool {
	for _, pod := range pods {
		if pod.Status.Phase == corev1.PodRunning {
			return true
		}
	}
	return false
}

// ListPersistentVolumeClaims lists all PersistentVolumeClaims in a given namespace, optionally filtered by a label selector,
func (self *KubeClient) ListPersistentVolumeClaims(ctx context.Context, namespace string, labels map[string]string, client kubernetes.Interface) ([]*models.PVCInfo, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace cannot be empty")
	}

	listOptions := metav1.ListOptions{}
	var selectors []string
	for key, value := range labels {
		selectors = append(selectors, fmt.Sprintf("%s=%s", key, value))
	}
	listOptions.LabelSelector = strings.Join(selectors, ",")

	pvcList, err := client.CoreV1().PersistentVolumeClaims(namespace).List(ctx, listOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to list PersistentVolumeClaims in namespace '%s' with selector '%s': %w", namespace, listOptions.LabelSelector, err)
	}

	// List all pods ONCE and build a map of PVC -> Pods using it
	podList, err := client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods in namespace '%s': %w", namespace, err)
	}

	// Build map: PVC name -> list of pods using it
	pvcToPods := make(map[string][]corev1.Pod)
	for _, pod := range podList.Items {
		for _, volume := range pod.Spec.Volumes {
			if volume.PersistentVolumeClaim != nil {
				pvcName := volume.PersistentVolumeClaim.ClaimName
				pvcToPods[pvcName] = append(pvcToPods[pvcName], pod)
			}
		}
	}

	var result []*models.PVCInfo
	for i := range pvcList.Items {
		pvc := &pvcList.Items[i]
		info, err := self.buildPVCInfo(ctx, pvc, pvcToPods[pvc.Name])
		if err != nil {
			return nil, err
		}
		if info == nil {
			continue
		}
		result = append(result, info)
	}

	// Sort the result by CreatedAt in descending order
	slices.SortFunc(result, func(a, b *models.PVCInfo) int {
		if a.CreatedAt.After(b.CreatedAt) {
			return -1
		} else if a.CreatedAt.Before(b.CreatedAt) {
			return 1
		}
		return 0
	})

	return result, nil
}

// DeletePersistentVolumeClaim deletes a specific PersistentVolumeClaim by its name and namespace.
func (self *KubeClient) DeletePersistentVolumeClaim(ctx context.Context, namespace string, pvcName string, client kubernetes.Interface) error {
	if namespace == "" {
		return fmt.Errorf("namespace cannot be empty")
	}
	if pvcName == "" {
		return fmt.Errorf("pvcName cannot be empty")
	}

	// Get the PVC to check its owner references
	pvc, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, pvcName, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, fmt.Sprintf("PersistentVolumeClaim '%s' not found", pvcName))
		}
		return wrapForbidden(err, fmt.Sprintf("failed to get PersistentVolumeClaim '%s'", pvcName))
	}

	// Check if PVC has any owner references
	if len(pvc.OwnerReferences) > 0 {
		ownerNames := make([]string, 0, len(pvc.OwnerReferences))
		for _, owner := range pvc.OwnerReferences {
			ownerNames = append(ownerNames, fmt.Sprintf("%s/%s", owner.Kind, owner.Name))
		}
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput,
			fmt.Sprintf("Cannot delete PVC '%s' as it is owned by: %s", pvcName, strings.Join(ownerNames, ", ")))
	}

	// Check if PVC is in use by any pods
	pods, err := self.GetPodsUsingPVC(ctx, namespace, pvcName, client)
	if err != nil {
		return fmt.Errorf("failed to check if PVC is in use: %w", err)
	}
	if blocking := mountBlockingPods(pods); len(blocking) > 0 {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("Cannot delete PVC '%s' as it is currently in use by %d pod(s)", pvcName, len(blocking)))
	}

	// The default storage class retains PVs, so an explicit volume delete must
	// switch the bound PV to Delete or the underlying storage is never freed.
	// PersistentVolumes are cluster-scoped and users only have namespace RBAC,
	// so this plumbing runs on the API's own ServiceAccount; the ClaimRef check
	// keeps it limited to the PV backing exactly this PVC.
	pvName := pvc.Spec.VolumeName
	var originalPolicy corev1.PersistentVolumeReclaimPolicy
	patchedPV := false
	if pvName != "" {
		pv, err := self.clientset.CoreV1().PersistentVolumes().Get(ctx, pvName, metav1.GetOptions{})
		switch {
		case errors.IsNotFound(err):
			// No backing volume left to release
		case err != nil:
			return fmt.Errorf("failed to get PersistentVolume '%s' backing PVC '%s': %w", pvName, pvcName, err)
		case pv.Spec.ClaimRef != nil && (pv.Spec.ClaimRef.Namespace != namespace || pv.Spec.ClaimRef.Name != pvcName):
			return fmt.Errorf("PersistentVolume '%s' is not bound to PVC '%s/%s', refusing to release it", pvName, namespace, pvcName)
		case pv.Spec.PersistentVolumeReclaimPolicy != corev1.PersistentVolumeReclaimDelete:
			originalPolicy = pv.Spec.PersistentVolumeReclaimPolicy
			if err := patchPVReclaimPolicy(ctx, self.clientset, pvName, corev1.PersistentVolumeReclaimDelete); err != nil {
				return fmt.Errorf("failed to set reclaim policy on PersistentVolume '%s': %w", pvName, err)
			}
			patchedPV = true
		}
	}

	err = client.CoreV1().PersistentVolumeClaims(namespace).Delete(ctx, pvcName, metav1.DeleteOptions{})
	if err != nil {
		if patchedPV {
			if revertErr := patchPVReclaimPolicy(ctx, self.clientset, pvName, originalPolicy); revertErr != nil {
				log.Errorf("failed to restore reclaim policy '%s' on PersistentVolume '%s' after failed PVC deletion: %v", originalPolicy, pvName, revertErr)
			}
		}
		return wrapForbidden(err, fmt.Sprintf("failed to delete PersistentVolumeClaim '%s' in namespace '%s'", pvcName, namespace))
	}
	return nil
}

// wrapForbidden surfaces Kubernetes RBAC rejections as typed unauthorized errors
// so they map to a 403 instead of a generic 500.
func wrapForbidden(err error, msg string) error {
	if errors.IsForbidden(err) {
		return fmt.Errorf("%s: %w", msg, errdefs.ErrUnauthorized)
	}
	return fmt.Errorf("%s: %w", msg, err)
}

func patchPVReclaimPolicy(ctx context.Context, client kubernetes.Interface, pvName string, policy corev1.PersistentVolumeReclaimPolicy) error {
	patch := fmt.Sprintf(`{"spec":{"persistentVolumeReclaimPolicy":%q}}`, policy)
	_, err := client.CoreV1().PersistentVolumes().Patch(ctx, pvName, types.MergePatchType, []byte(patch), metav1.PatchOptions{})
	return err
}

// GetPodsUsingPVC finds all pods in a given namespace that are mounting the specified PVC.
func (self *KubeClient) GetPodsUsingPVC(ctx context.Context, namespace string, pvcName string, client kubernetes.Interface) ([]corev1.Pod, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace cannot be empty")
	}
	if pvcName == "" {
		return nil, fmt.Errorf("pvcName cannot be empty")
	}

	podList, err := client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods in namespace '%s': %w", namespace, err)
	}

	var podsUsingPVC []corev1.Pod
	for _, pod := range podList.Items {
		for _, volume := range pod.Spec.Volumes {
			if volume.PersistentVolumeClaim != nil && volume.PersistentVolumeClaim.ClaimName == pvcName {
				podsUsingPVC = append(podsUsingPVC, pod)
				break // Move to the next pod once a match is found for this pod
			}
		}
	}
	return podsUsingPVC, nil
}

// isRejectedByAPIServer reports whether the API server (or an admission webhook) refused the
// request for reasons the caller can act on, as opposed to transport or auth failures.
func isRejectedByAPIServer(err error) bool {
	return errors.IsInvalid(err) || errors.IsForbidden(err) || errors.IsBadRequest(err) || errors.IsInternalError(err)
}
