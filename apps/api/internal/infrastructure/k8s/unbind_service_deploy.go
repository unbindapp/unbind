package k8s

import (
	"context"
	"fmt"

	// Import the operator API package
	unbindv1 "github.com/unbindapp/unbind-operator/api/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// DeployImage creates (or replaces) the service resource in the target namespace
// for deployment after a successful build job.
func (self *KubeClient) DeployUnbindService(ctx context.Context, service *unbindv1.Service) (*unstructured.Unstructured, *unbindv1.Service, error) {
	// Convert to unstructured for the dynamic client
	unstructuredObj, err := convertToUnstructured(service)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to convert service to unstructured: %v", err)
	}

	// Define the GroupVersionResource for the Service custom resource
	serviceGVR := schema.GroupVersionResource{
		Group:    "unbind.unbind.app",
		Version:  "v1",
		Resource: "services", // plural name of the custom resource
	}

	createdCR, err := self.client.Resource(serviceGVR).Namespace(service.Namespace).Create(ctx, unstructuredObj, metav1.CreateOptions{})
	if err != nil {
		// If the resource already exists, update it
		if apierrors.IsAlreadyExists(err) {
			res, err := updateExistingServiceCR(ctx, self, serviceGVR, service.Namespace, unstructuredObj)
			return res, service, err
		}
		return nil, nil, fmt.Errorf("failed to create service custom resource: %v", err)
	}

	return createdCR, service, nil
}

// updateExistingServiceCR handles updating an existing Service custom resource
func updateExistingServiceCR(ctx context.Context, client *KubeClient, gvr schema.GroupVersionResource, namespace string, newCR *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	existingCR, err := client.client.Resource(gvr).Namespace(namespace).Get(ctx, newCR.GetName(), metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve existing service: %v", err)
	}

	// Set the resourceVersion on the object to be updated
	newCR.SetResourceVersion(existingCR.GetResourceVersion())

	updatedCR, err := client.client.Resource(gvr).Namespace(namespace).Update(ctx, newCR, metav1.UpdateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to update service custom resource: %v", err)
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
