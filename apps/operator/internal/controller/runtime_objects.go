package controller

import (
	"context"
	"fmt"
	"maps"
	"reflect"

	altinityv1 "github.com/altinity/clickhouse-operator/pkg/apis/clickhouse.altinity.com/v1"
	mocov1beta2 "github.com/cybozu-go/moco/api/v1beta2"
	helmv2 "github.com/fluxcd/helm-controller/api/v2"
	sourcev1 "github.com/fluxcd/source-controller/api/v1"
	"github.com/go-logr/logr"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	postgresv1 "github.com/zalando/postgres-operator/pkg/apis/acid.zalan.do/v1"
	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"
)

func (r *ServiceReconciler) reconcileRuntimeObjects(ctx context.Context, objects []runtime.Object, service v1.Service) error {
	for _, obj := range objects {
		if err := r.reconcileSingleRuntimeObject(ctx, obj, &service); err != nil {
			return err
		}
	}
	return nil
}

func (r *ServiceReconciler) reconcileSingleRuntimeObject(ctx context.Context, obj runtime.Object, service *v1.Service) error {
	switch typedObj := obj.(type) {
	case *batchv1.Job:
		return wrapReconcileErr("Job", r.reconcileJob(ctx, typedObj, service))
	case *postgresv1.Postgresql:
		return wrapReconcileErr("Postgresql", r.reconcilePostgresql(ctx, typedObj, service))
	case *helmv2.HelmRelease:
		return wrapReconcileErr("HelmRelease", r.reconcileHelmRelease(ctx, typedObj, service))
	case *sourcev1.HelmRepository:
		return wrapReconcileErr("HelmRepository", r.reconcileHelmRepository(ctx, typedObj, service))
	case *mocov1beta2.MySQLCluster:
		return wrapReconcileErr("MySQLCluster", r.reconcileMySQLCluster(ctx, typedObj, service))
	case *mocov1beta2.BackupPolicy:
		return wrapReconcileErr("BackupPolicy", r.reconcileBackupPolicy(ctx, typedObj, service))
	case *altinityv1.ClickHouseInstallation:
		return wrapReconcileErr("ClickHouseInstallation", r.reconcileClickhouseInstallation(ctx, typedObj, service))
	default:
		return r.reconcileGenericObject(ctx, obj, service)
	}
}

func wrapReconcileErr(kind string, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("reconciling %s: %w", kind, err)
}

func (r *ServiceReconciler) reconcileGenericObject(ctx context.Context, obj runtime.Object, service *v1.Service) error {
	logger := log.FromContext(ctx)

	metaObj, err := meta.Accessor(obj)
	if err != nil {
		logger.Error(err, "Failed to get object metadata")
		return fmt.Errorf("accessing object metadata: %w", err)
	}

	gvk := obj.GetObjectKind().GroupVersionKind()
	kind := gvk.Kind
	if kind == "" {
		kind = fmt.Sprintf("%T", obj)
	}

	existing, err := r.getExistingObject(ctx, obj)
	if err != nil {
		if !errors.IsNotFound(err) {
			logger.Error(err, "Failed to get existing object", "kind", kind, "name", metaObj.GetName(), "namespace", metaObj.GetNamespace())
			return fmt.Errorf("getting existing object: %w", err)
		}
		return r.createGenericObject(ctx, logger, obj, metaObj, gvk, kind, service)
	}

	return r.updateGenericObject(ctx, logger, obj, existing, metaObj, gvk, kind, service)
}

func (r *ServiceReconciler) createGenericObject(ctx context.Context, logger logr.Logger, obj runtime.Object, metaObj metav1.Object, gvk schema.GroupVersionKind, kind string, service *v1.Service) error {
	logger.Info("Creating object", "kind", kind, "name", metaObj.GetName(), "namespace", metaObj.GetNamespace(), "apiVersion", gvk.GroupVersion().String())

	if err := controllerutil.SetControllerReference(service, metaObj, r.Scheme); err != nil {
		return fmt.Errorf("setting controller reference: %w", err)
	}

	createObj, err := toClientObject(obj, gvk)
	if err != nil {
		return err
	}

	if err := r.Create(ctx, createObj); err != nil {
		return fmt.Errorf("creating %s %s/%s: %w", kind, metaObj.GetNamespace(), metaObj.GetName(), err)
	}
	return nil
}

func (r *ServiceReconciler) updateGenericObject(ctx context.Context, logger logr.Logger, desired, existing runtime.Object, metaObj metav1.Object, gvk schema.GroupVersionKind, kind string, service *v1.Service) error {
	needsUpdate, err := r.objectNeedsUpdate(desired, existing)
	if err != nil {
		return fmt.Errorf("checking if update needed: %w", err)
	}

	if !needsUpdate {
		logger.Info("Object already up to date", "kind", kind, "name", metaObj.GetName(), "namespace", metaObj.GetNamespace())
		return nil
	}

	logger.Info("Updating object", "kind", kind, "name", metaObj.GetName(), "namespace", metaObj.GetNamespace(), "apiVersion", gvk.GroupVersion().String())

	if err := r.updateObject(existing, desired); err != nil {
		return fmt.Errorf("updating object spec: %w", err)
	}

	existingMeta, err := meta.Accessor(existing)
	if err != nil {
		return fmt.Errorf("getting metadata from existing object: %w", err)
	}

	if err := controllerutil.SetControllerReference(service, existingMeta, r.Scheme); err != nil {
		return fmt.Errorf("setting controller reference: %w", err)
	}

	updateObj, ok := existing.(client.Object)
	if !ok {
		return fmt.Errorf("existing object is not a client.Object: %T", existing)
	}

	if err := r.Update(ctx, updateObj); err != nil {
		return fmt.Errorf("updating %s %s/%s: %w", kind, existingMeta.GetNamespace(), existingMeta.GetName(), err)
	}
	return nil
}

func toClientObject(obj runtime.Object, gvk schema.GroupVersionKind) (client.Object, error) {
	if clientObj, ok := obj.(client.Object); ok {
		return clientObj, nil
	}
	u := &unstructured.Unstructured{}
	u.SetGroupVersionKind(gvk)
	objData, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	if err != nil {
		return nil, fmt.Errorf("converting object to unstructured: %w", err)
	}
	u.SetUnstructuredContent(objData)
	return u, nil
}

// getExistingObject gets an existing object of the same type and with the same name/namespace
func (r *ServiceReconciler) getExistingObject(ctx context.Context, obj runtime.Object) (runtime.Object, error) {
	metaObj, err := meta.Accessor(obj)
	if err != nil {
		return nil, fmt.Errorf("getting metadata: %w", err)
	}

	gvk := obj.GetObjectKind().GroupVersionKind()

	u := &unstructured.Unstructured{}
	u.SetGroupVersionKind(gvk)

	err = r.Get(ctx, client.ObjectKey{Namespace: metaObj.GetNamespace(), Name: metaObj.GetName()}, u)
	if err != nil {
		return nil, err
	}

	// Convert built-in types back for easier handling; keep CRDs and unknown types as unstructured.
	switch gvk.Kind {
	case "Deployment":
		deployment := &appsv1.Deployment{}
		if err := runtime.DefaultUnstructuredConverter.FromUnstructured(u.Object, deployment); err != nil {
			return nil, fmt.Errorf("converting unstructured to Deployment: %w", err)
		}
		return deployment, nil
	case "Service":
		service := &corev1.Service{}
		if err := runtime.DefaultUnstructuredConverter.FromUnstructured(u.Object, service); err != nil {
			return nil, fmt.Errorf("converting unstructured to Service: %w", err)
		}
		return service, nil
	case "Ingress":
		ingress := &networkingv1.Ingress{}
		if err := runtime.DefaultUnstructuredConverter.FromUnstructured(u.Object, ingress); err != nil {
			return nil, fmt.Errorf("converting unstructured to Ingress: %w", err)
		}
		return ingress, nil
	default:
		return u, nil
	}
}

// objectNeedsUpdate determines if an object needs to be updated
func (r *ServiceReconciler) objectNeedsUpdate(desired, existing runtime.Object) (bool, error) {
	if _, ok := existing.(*unstructured.Unstructured); ok {
		return r.genericObjectNeedsUpdate(desired, existing)
	}

	switch desiredTyped := desired.(type) {
	case *appsv1.Deployment:
		existingTyped, ok := existing.(*appsv1.Deployment)
		if !ok {
			return false, fmt.Errorf("existing object is not a Deployment")
		}
		return !reflect.DeepEqual(existingTyped.Spec, desiredTyped.Spec), nil

	case *corev1.Service:
		existingTyped, ok := existing.(*corev1.Service)
		if !ok {
			return false, fmt.Errorf("existing object is not a Service")
		}
		switch {
		case !reflect.DeepEqual(existingTyped.Spec.Ports, desiredTyped.Spec.Ports):
			return true, nil
		case !reflect.DeepEqual(existingTyped.Spec.Selector, desiredTyped.Spec.Selector):
			return true, nil
		case existingTyped.Spec.Type != desiredTyped.Spec.Type:
			return true, nil
		default:
			return false, nil
		}

	case *networkingv1.Ingress:
		existingTyped, ok := existing.(*networkingv1.Ingress)
		if !ok {
			return false, fmt.Errorf("existing object is not an Ingress")
		}
		return !reflect.DeepEqual(existingTyped.Spec, desiredTyped.Spec), nil

	case *corev1.ConfigMap:
		existingTyped, ok := existing.(*corev1.ConfigMap)
		if !ok {
			return false, fmt.Errorf("existing object is not a ConfigMap")
		}
		return !reflect.DeepEqual(existingTyped.Data, desiredTyped.Data) ||
			!reflect.DeepEqual(existingTyped.BinaryData, desiredTyped.BinaryData), nil

	case *corev1.Secret:
		existingTyped, ok := existing.(*corev1.Secret)
		if !ok {
			return false, fmt.Errorf("existing object is not a Secret")
		}
		return !reflect.DeepEqual(existingTyped.Data, desiredTyped.Data) ||
			!reflect.DeepEqual(existingTyped.StringData, desiredTyped.StringData) ||
			existingTyped.Type != desiredTyped.Type, nil

	default:
		return r.genericObjectNeedsUpdate(desired, existing)
	}
}

// genericObjectNeedsUpdate provides a generic comparison for objects without type-specific logic
func (r *ServiceReconciler) genericObjectNeedsUpdate(desired, existing runtime.Object) (bool, error) {
	desiredUnstructured, err := runtime.DefaultUnstructuredConverter.ToUnstructured(desired)
	if err != nil {
		return false, fmt.Errorf("converting desired object to unstructured: %w", err)
	}

	existingUnstructured, err := runtime.DefaultUnstructuredConverter.ToUnstructured(existing)
	if err != nil {
		return false, fmt.Errorf("converting existing object to unstructured: %w", err)
	}

	desiredUnstructured = removeNonComparedFields(desiredUnstructured)
	existingUnstructured = removeNonComparedFields(existingUnstructured)

	return !reflect.DeepEqual(desiredUnstructured, existingUnstructured), nil
}

// removeNonComparedFields removes fields that should not be part of the comparison
func removeNonComparedFields(obj map[string]any) map[string]any {
	result := make(map[string]any)
	for k, v := range obj {
		if k == "status" {
			continue
		}

		if k == "metadata" {
			if metadata, ok := v.(map[string]any); ok {
				filteredMetadata := make(map[string]any)
				for mk, mv := range metadata {
					if mk != "resourceVersion" && mk != "generation" &&
						mk != "uid" && mk != "creationTimestamp" &&
						mk != "managedFields" && mk != "selfLink" {
						filteredMetadata[mk] = mv
					}
				}
				result[k] = filteredMetadata
			}
			continue
		}

		result[k] = v
	}
	return result
}

// updateObject updates the spec of an existing object with the desired values
func (r *ServiceReconciler) updateObject(existing, desired runtime.Object) error {
	if unstructuredExisting, ok := existing.(*unstructured.Unstructured); ok {
		return r.updateUnstructuredObject(unstructuredExisting, desired)
	}

	switch desiredTyped := desired.(type) {
	case *batchv1.Job:
		// Jobs have immutable specs; reconcileJob handles recreation.
		return nil

	case *appsv1.Deployment:
		existingTyped, ok := existing.(*appsv1.Deployment)
		if !ok {
			return fmt.Errorf("existing object is not a Deployment")
		}
		existingTyped.Spec = desiredTyped.Spec

	case *corev1.Service:
		existingTyped, ok := existing.(*corev1.Service)
		if !ok {
			return fmt.Errorf("existing object is not a Service")
		}
		// Preserve the immutable ClusterIP.
		clusterIP := existingTyped.Spec.ClusterIP
		existingTyped.Spec = desiredTyped.Spec
		existingTyped.Spec.ClusterIP = clusterIP

	case *networkingv1.Ingress:
		existingTyped, ok := existing.(*networkingv1.Ingress)
		if !ok {
			return fmt.Errorf("existing object is not an Ingress")
		}
		existingTyped.Spec = desiredTyped.Spec

	case *corev1.ConfigMap:
		existingTyped, ok := existing.(*corev1.ConfigMap)
		if !ok {
			return fmt.Errorf("existing object is not a ConfigMap")
		}
		existingTyped.Data = desiredTyped.Data
		existingTyped.BinaryData = desiredTyped.BinaryData

	case *corev1.Secret:
		existingTyped, ok := existing.(*corev1.Secret)
		if !ok {
			return fmt.Errorf("existing object is not a Secret")
		}
		existingTyped.Data = desiredTyped.Data
		existingTyped.StringData = desiredTyped.StringData
		existingTyped.Type = desiredTyped.Type

	default:
		return r.genericUpdateObject(existing, desired)
	}

	return nil
}

// updateUnstructuredObject updates an unstructured object with the desired values
func (r *ServiceReconciler) updateUnstructuredObject(existing *unstructured.Unstructured, desired runtime.Object) error {
	var desiredUnstructured *unstructured.Unstructured

	if u, ok := desired.(*unstructured.Unstructured); ok {
		desiredUnstructured = u
	} else {
		u := &unstructured.Unstructured{}
		u.SetGroupVersionKind(desired.GetObjectKind().GroupVersionKind())

		objData, err := runtime.DefaultUnstructuredConverter.ToUnstructured(desired)
		if err != nil {
			return fmt.Errorf("converting desired to unstructured: %w", err)
		}
		u.SetUnstructuredContent(objData)
		desiredUnstructured = u
	}

	existingObj := existing.UnstructuredContent()
	desiredObj := desiredUnstructured.UnstructuredContent()

	existingMeta, hasExistingMeta := existingObj["metadata"].(map[string]any)
	desiredMeta, hasDesiredMeta := desiredObj["metadata"].(map[string]any)

	if hasExistingMeta && hasDesiredMeta {
		preserveFields := []string{
			"resourceVersion",
			"uid",
			"generation",
			"creationTimestamp",
			"selfLink",
			"managedFields",
		}

		for _, field := range preserveFields {
			if val, exists := existingMeta[field]; exists {
				desiredMeta[field] = val
			}
		}

		desiredObj["metadata"] = desiredMeta
	}

	if desiredUnstructured.GetKind() == "Service" {
		// Preserve the immutable Service ClusterIP.
		if existingSpec, hasExistingSpec := existingObj["spec"].(map[string]any); hasExistingSpec {
			if desiredSpec, hasDesiredSpec := desiredObj["spec"].(map[string]any); hasDesiredSpec {
				if clusterIP, exists := existingSpec["clusterIP"]; exists && clusterIP != nil {
					desiredSpec["clusterIP"] = clusterIP
				}
				desiredObj["spec"] = desiredSpec
			}
		}
	}

	if existingStatus, exists := existingObj["status"]; exists {
		desiredObj["status"] = existingStatus
	}

	existing.SetUnstructuredContent(desiredObj)

	return nil
}

// genericUpdateObject provides a generic update mechanism for objects without type-specific logic
func (r *ServiceReconciler) genericUpdateObject(existing, desired runtime.Object) error {
	desiredUnstructured, err := runtime.DefaultUnstructuredConverter.ToUnstructured(desired)
	if err != nil {
		return fmt.Errorf("converting desired object to unstructured: %w", err)
	}

	existingUnstructured, err := runtime.DefaultUnstructuredConverter.ToUnstructured(existing)
	if err != nil {
		return fmt.Errorf("converting existing object to unstructured: %w", err)
	}

	preservedFields := preserveImmutableFields(existingUnstructured)

	for k, v := range desiredUnstructured {
		if k != "metadata" && k != "status" && k != "apiVersion" && k != "kind" {
			existingUnstructured[k] = v
		}
	}

	maps.Copy(existingUnstructured, preservedFields)

	return runtime.DefaultUnstructuredConverter.FromUnstructured(existingUnstructured, existing)
}

// preserveImmutableFields extracts fields that should be preserved during an update
func preserveImmutableFields(obj map[string]any) map[string]any {
	preserved := make(map[string]any)

	if spec, ok := obj["spec"].(map[string]any); ok {
		if clusterIP, ok := spec["clusterIP"]; ok {
			if preserved["spec"] == nil {
				preserved["spec"] = make(map[string]any)
			}
			preserved["spec"].(map[string]any)["clusterIP"] = clusterIP
		}
	}

	return preserved
}
