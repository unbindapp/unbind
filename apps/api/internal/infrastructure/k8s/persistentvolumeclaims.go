package k8s

import (
	"context"
	"fmt"
	"slices"
	"strconv"
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
	"k8s.io/client-go/kubernetes"
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

	labels["pvc-display-name"] = displayName

	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      pvcName,
			Namespace: namespace,
			Labels:    labels,
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
func (self *KubeClient) resolvePVCServiceBinding(ctx context.Context, pvcName, serviceLabel string, pvcLabels map[string]string) (boundToServiceID *uuid.UUID, isDatabase bool, err error) {
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
func (self *KubeClient) resolvePVCBinding(ctx context.Context, pvcName, serviceLabel string, pvcLabels map[string]string, pods []corev1.Pod) (*pvcBinding, error) {
	serviceID, isDatabase, err := self.resolvePVCServiceBinding(ctx, pvcName, serviceLabel, pvcLabels)
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

	const ( // Define label keys for consistency
		teamLabel        = "unbind-team"
		projectLabel     = "unbind-project"
		environmentLabel = "unbind-environment"
		serviceLabel     = "unbind-service"
	)

	pvcLabels := pvc.GetLabels()
	teamIDStr := pvcLabels[teamLabel]
	// Skip if the PVC doesn't have the unbind-team label
	if teamIDStr == "" {
		return nil, fmt.Errorf("PVC '%s' does not have required team label", pvcName)
	}

	teamID, err := uuid.Parse(teamIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid team ID in PVC '%s': %w", pvcName, err)
	}

	projectIDStr := pvcLabels[projectLabel]
	environmentIDStr := pvcLabels[environmentLabel]
	sizeGBValueStr := ""
	var sizeGBValue float64
	var bytesValueCapacity int64
	var bytesValueRequest int64
	var bytesValue int64
	if pvc.Status.Capacity != nil {
		if capacityQuantity, ok := pvc.Status.Capacity[corev1.ResourceStorage]; ok {
			bytesValue = capacityQuantity.Value()
			bytesValueCapacity = bytesValue
		}
	}
	if storageRequest, ok := pvc.Spec.Resources.Requests[corev1.ResourceStorage]; ok {
		if pvc.Status.Capacity == nil {
			bytesValue = storageRequest.Value()
		}
		bytesValueRequest = storageRequest.Value()
	}
	gbValue := float64(bytesValue) / (1024 * 1024 * 1024)
	sizeGBValueStr = fmt.Sprintf("%.2f", gbValue) // Format to 2 decimal places
	sizeGBValueStr = strings.TrimSuffix(sizeGBValueStr, ".00")
	sizeGBValue, err = strconv.ParseFloat(sizeGBValueStr, 64)
	if err != nil {
		return nil, fmt.Errorf("failed to parse sizeGBValue '%s': %w", sizeGBValueStr, err)
	}

	pods, err := self.GetPodsUsingPVC(ctx, pvc.Namespace, pvc.Name, client)
	if err != nil {
		return nil, fmt.Errorf("failed to get pods using PVC '%s': %w", pvcName, err)
	}

	binding, err := self.resolvePVCBinding(ctx, pvcName, serviceLabel, pvcLabels, pods)
	if err != nil {
		return nil, err
	}

	var projectID *uuid.UUID
	if projectIDStr != "" {
		projectIDParsed, err := uuid.Parse(projectIDStr)
		if err == nil {
			projectID = &projectIDParsed
		}
	}

	var environmentID *uuid.UUID
	if environmentIDStr != "" {
		environmentIDParsed, err := uuid.Parse(environmentIDStr)
		if err == nil {
			environmentID = &environmentIDParsed
		}
	}

	// A PVC with a deletion timestamp is terminating — kubernetes removes the
	// object asynchronously once its finalizers are cleared.
	isDeleting := pvc.DeletionTimestamp != nil

	// Check if PVC can be deleted (no owners, not in use, not already terminating)
	canDelete := len(pvc.OwnerReferences) == 0 && binding.ServiceID == nil && !binding.InUseByPods && !isDeleting

	// Get type
	pvcType := models.PvcScopeTeam
	if projectID != nil && environmentID != nil {
		pvcType = models.PvcScopeEnvironment
	} else if projectID != nil {
		pvcType = models.PvcScopeProject
	}

	isPendingResize := bytesValueRequest > bytesValueCapacity

	// If a database, query the DB config
	if binding.IsDatabase && binding.ServiceID != nil {
		dbSvcConfig, err := self.repo.Service().GetDatabaseConfig(ctx, *binding.ServiceID)
		if err != nil && !ent.IsNotFound(err) {
			log.Errorf("failed to get database config for service '%s': %v", binding.ServiceID.String(), err)
			return nil, fmt.Errorf("failed to get database config for service '%s': %w", binding.ServiceID.String(), err)
		} else if dbSvcConfig != nil && dbSvcConfig.StorageSize != "" {
			// Parse storage size
			qty, err := utils.ParseStorageQuantity(dbSvcConfig.StorageSize)
			if err != nil {
				return nil, fmt.Errorf("failed to parse storage size '%s' for service '%s': %w", dbSvcConfig.StorageSize, binding.ServiceID.String(), err)
			}
			if qty.Value() > bytesValueCapacity {
				isPendingResize = true
			}
		}
	}

	// Assume PVC not created yet
	if bytesValueCapacity == 0 {
		isPendingResize = false
	}

	return &models.PVCInfo{
		ID:                 pvc.Name,
		Type:               pvcType,
		IsPendingResize:    isPendingResize,
		CapacityGB:         sizeGBValue,
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
	const (
		teamLabel        = "unbind-team"
		projectLabel     = "unbind-project"
		environmentLabel = "unbind-environment"
		serviceLabel     = "unbind-service"
	)

	for _, pvc := range pvcList.Items {
		pvcLabels := pvc.GetLabels()
		teamIDStr := pvcLabels[teamLabel]
		// Skip if the PVC doesn't have the unbind-team label
		if teamIDStr == "" {
			continue
		}

		teamID, err := uuid.Parse(teamIDStr)

		// Skip if the team ID is not valid
		if err != nil {
			continue
		}

		projectIDStr := pvcLabels[projectLabel]
		environmentIDStr := pvcLabels[environmentLabel]
		sizeGBValueStr := ""
		var sizeGBValue float64
		var bytesValueCapacity int64
		var bytesValueRequest int64
		var bytesValue int64
		if pvc.Status.Capacity != nil {
			if capacityQuantity, ok := pvc.Status.Capacity[corev1.ResourceStorage]; ok {
				bytesValue = capacityQuantity.Value()
				bytesValueCapacity = bytesValue
			}
		}
		if storageRequest, ok := pvc.Spec.Resources.Requests[corev1.ResourceStorage]; ok {
			if pvc.Status.Capacity == nil {
				bytesValue = storageRequest.Value()
			}
			bytesValueRequest = storageRequest.Value()
		}
		gbValue := float64(bytesValue) / (1024 * 1024 * 1024)
		sizeGBValueStr = fmt.Sprintf("%.2f", gbValue) // Format to 2 decimal places
		sizeGBValueStr = strings.TrimSuffix(sizeGBValueStr, ".00")
		sizeGBValue, err = strconv.ParseFloat(sizeGBValueStr, 64)
		if err != nil {
			continue
		}

		binding, err := self.resolvePVCBinding(ctx, pvc.Name, serviceLabel, pvcLabels, pvcToPods[pvc.Name])
		if err != nil {
			log.Errorf("failed to resolve binding for PVC '%s': %v", pvc.Name, err)
			continue
		}

		var projectID *uuid.UUID
		if projectIDStr != "" {
			projectIDParsed, err := uuid.Parse(projectIDStr)
			if err == nil {
				projectID = &projectIDParsed
			}
		}

		var environmentID *uuid.UUID
		if environmentIDStr != "" {
			environmentIDParsed, err := uuid.Parse(environmentIDStr)
			if err == nil {
				environmentID = &environmentIDParsed
			}
		}
		// A PVC with a deletion timestamp is terminating — kubernetes removes the
		// object asynchronously once its finalizers are cleared.
		isDeleting := pvc.DeletionTimestamp != nil

		// Check if PVC can be deleted (no owners, not in use, not already terminating)
		canDelete := len(pvc.OwnerReferences) == 0 && binding.ServiceID == nil && !binding.InUseByPods && !isDeleting

		// Figure out type
		pvcType := models.PvcScopeTeam
		if projectID != nil && environmentID != nil {
			pvcType = models.PvcScopeEnvironment
		} else if projectID != nil {
			pvcType = models.PvcScopeProject
		}

		isPendingResize := bytesValueRequest > bytesValueCapacity

		// If a databsae, query the DB config
		if binding.IsDatabase && binding.ServiceID != nil {
			dbSvcConfig, err := self.repo.Service().GetDatabaseConfig(ctx, *binding.ServiceID)
			if err != nil && !ent.IsNotFound(err) {
				log.Errorf("failed to get database config for service '%s': %v", binding.ServiceID.String(), err)
				return nil, fmt.Errorf("failed to get database config for service '%s': %w", binding.ServiceID.String(), err)
			} else if dbSvcConfig != nil && dbSvcConfig.StorageSize != "" {
				// Parse storage size
				qty, err := utils.ParseStorageQuantity(dbSvcConfig.StorageSize)
				if err != nil {
					return nil, fmt.Errorf("failed to parse storage size '%s' for service '%s': %w", dbSvcConfig.StorageSize, binding.ServiceID.String(), err)
				}
				if qty.Value() > bytesValueCapacity {
					isPendingResize = true
				}
			}
		}

		// Assume PVC not created yet
		if bytesValueCapacity == 0 {
			isPendingResize = false
		}

		result = append(result, &models.PVCInfo{
			ID:                 pvc.Name,
			Type:               pvcType,
			IsPendingResize:    isPendingResize,
			CapacityGB:         sizeGBValue,
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
		})
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
		return fmt.Errorf("failed to get PersistentVolumeClaim '%s': %w", pvcName, err)
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

	err = client.CoreV1().PersistentVolumeClaims(namespace).Delete(ctx, pvcName, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete PersistentVolumeClaim '%s' in namespace '%s': %w", pvcName, namespace, err)
	}
	return nil
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
