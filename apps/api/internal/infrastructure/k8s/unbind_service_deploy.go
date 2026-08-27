package k8s

import (
	"context"
	"fmt"

	unbindv1 "github.com/unbindapp/unbind-operator/api/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
)

// DeployUnbindService creates (or replaces) the service resource in the target namespace,
// validating it against the API server with a dry run before any real write.
func (self *KubeClient) DeployUnbindService(ctx context.Context, service *unbindv1.Service) (*unstructured.Unstructured, *unbindv1.Service, error) {
	unstructuredObj, err := convertToUnstructured(service)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to convert service to unstructured: %w", err)
	}

	services := self.client.Resource(servicesGVR).Namespace(service.Namespace)
	dryRun := []string{metav1.DryRunAll}

	if _, err := services.Create(ctx, unstructuredObj, metav1.CreateOptions{DryRun: dryRun}); err != nil && !apierrors.IsAlreadyExists(err) {
		return nil, nil, fmt.Errorf("service custom resource failed validation: %w", err)
	}

	createdCR, err := services.Create(ctx, unstructuredObj, metav1.CreateOptions{})
	if err == nil {
		return createdCR, service, nil
	}
	if !apierrors.IsAlreadyExists(err) {
		return nil, nil, fmt.Errorf("failed to create service custom resource: %w", err)
	}

	res, err := updateExistingServiceCR(ctx, self, service.Namespace, unstructuredObj)
	return res, service, err
}

func updateExistingServiceCR(ctx context.Context, client *KubeClient, namespace string, newCR *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	services := client.client.Resource(servicesGVR).Namespace(namespace)

	existingCR, err := services.Get(ctx, newCR.GetName(), metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve existing service: %w", err)
	}

	newCR.SetResourceVersion(existingCR.GetResourceVersion())

	if _, err := services.Update(ctx, newCR, metav1.UpdateOptions{DryRun: []string{metav1.DryRunAll}}); err != nil {
		return nil, fmt.Errorf("service custom resource failed validation: %w", err)
	}

	updatedCR, err := services.Update(ctx, newCR, metav1.UpdateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to update service custom resource: %w", err)
	}

	return updatedCR, nil
}

// convertToUnstructured converts a runtime.Object to an Unstructured object
func convertToUnstructured(obj runtime.Object) (*unstructured.Unstructured, error) {
	if obj == nil {
		return nil, fmt.Errorf("cannot convert nil object to unstructured")
	}

	unstructuredObj := &unstructured.Unstructured{}

	data, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	if err != nil {
		return nil, err
	}

	unstructuredObj.SetUnstructuredContent(data)

	return unstructuredObj, nil
}
