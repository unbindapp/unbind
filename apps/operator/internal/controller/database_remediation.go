package controller

import (
	"context"
	"strings"
	"time"

	helmv2 "github.com/fluxcd/helm-controller/api/v2"
	fluxmeta "github.com/fluxcd/pkg/apis/meta"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	apimeta "k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"
)

// volumeClaimTemplates are immutable, so chart changes touching them stall the release forever
const stsImmutableErrorFragment = "Forbidden: updates to statefulset spec for fields other than"

func (r *ServiceReconciler) remediateStalledDatabaseRelease(ctx context.Context, service *v1.Service) error {
	release, err := r.ownedHelmRelease(ctx, service)
	if err != nil || release == nil {
		return err
	}
	if !releaseFailedOnImmutableStatefulSet(release) {
		return nil
	}

	logger := log.FromContext(ctx)
	logger.Info("Remediating helm release stalled on immutable StatefulSet", "release", release.Name, "namespace", release.Namespace)

	selector := client.MatchingLabels{"app.kubernetes.io/instance": release.Name}
	r.growReleasePVCs(ctx, service, selector)
	if err := r.orphanDeleteStatefulSets(ctx, release.Namespace, selector); err != nil {
		return err
	}
	return r.forceHelmReleaseRetry(ctx, release)
}

func releaseFailedOnImmutableStatefulSet(release *helmv2.HelmRelease) bool {
	if stalled := apimeta.FindStatusCondition(release.Status.Conditions, fluxmeta.StalledCondition); stalled != nil &&
		stalled.Status == metav1.ConditionTrue &&
		strings.Contains(stalled.Message, stsImmutableErrorFragment) {
		return true
	}
	ready := apimeta.FindStatusCondition(release.Status.Conditions, fluxmeta.ReadyCondition)
	return ready != nil &&
		ready.Status == metav1.ConditionFalse &&
		strings.Contains(ready.Message, stsImmutableErrorFragment)
}

// best effort: StorageClasses without allowVolumeExpansion reject the update
func (r *ServiceReconciler) growReleasePVCs(ctx context.Context, service *v1.Service, selector client.MatchingLabels) {
	logger := log.FromContext(ctx)
	desired, ok := databaseStorageQuantity(service)
	if !ok {
		return
	}

	var pvcs corev1.PersistentVolumeClaimList
	if err := r.List(ctx, &pvcs, client.InNamespace(service.Namespace), selector); err != nil {
		logger.Error(err, "Failed to list release PVCs")
		return
	}
	for i := range pvcs.Items {
		pvc := &pvcs.Items[i]
		current := pvc.Spec.Resources.Requests[corev1.ResourceStorage]
		if desired.Cmp(current) <= 0 {
			continue
		}
		pvc.Spec.Resources.Requests[corev1.ResourceStorage] = desired
		if err := r.Update(ctx, pvc); err != nil {
			logger.Error(err, "Failed to grow PVC", "pvc", pvc.Name)
			continue
		}
		logger.Info("Grew PVC", "pvc", pvc.Name, "size", desired.String())
	}
}

func databaseStorageQuantity(service *v1.Service) (resource.Quantity, bool) {
	config := service.Spec.Config.Database.Config
	if config == nil || config.StorageSize == nil {
		return resource.Quantity{}, false
	}
	return *config.StorageSize, true
}

func (r *ServiceReconciler) orphanDeleteStatefulSets(ctx context.Context, namespace string, selector client.MatchingLabels) error {
	var statefulSets appsv1.StatefulSetList
	if err := r.List(ctx, &statefulSets, client.InNamespace(namespace), selector); err != nil {
		return err
	}
	for i := range statefulSets.Items {
		if err := r.Delete(ctx, &statefulSets.Items[i], client.PropagationPolicy(metav1.DeletePropagationOrphan)); client.IgnoreNotFound(err) != nil {
			return err
		}
	}
	return nil
}

// flux force-upgrades only when both annotations carry the same token
func (r *ServiceReconciler) forceHelmReleaseRetry(ctx context.Context, release *helmv2.HelmRelease) error {
	token := time.Now().Format(time.RFC3339Nano)
	patch := client.MergeFrom(release.DeepCopy())
	annotations := release.GetAnnotations()
	if annotations == nil {
		annotations = map[string]string{}
	}
	annotations[fluxmeta.ReconcileRequestAnnotation] = token
	annotations[fluxmeta.ForceRequestAnnotation] = token
	release.SetAnnotations(annotations)
	return r.Patch(ctx, release, patch)
}
