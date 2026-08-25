package k8s

import (
	"context"
	"fmt"

	unbindv1 "github.com/unbindapp/unbind-operator/api/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var servicesGVR = schema.GroupVersionResource{
	Group:    "unbind.unbind.app",
	Version:  "v1",
	Resource: "services",
}

// GetUnbindServiceStatus returns nil without error when the CR has no status yet
func (self *KubeClient) GetUnbindServiceStatus(ctx context.Context, namespace, name string) (*unbindv1.ServiceStatus, error) {
	obj, err := self.client.Resource(servicesGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	statusMap, found, err := unstructured.NestedMap(obj.Object, "status")
	if err != nil {
		return nil, fmt.Errorf("failed to read service status: %w", err)
	}
	if !found {
		return nil, nil
	}

	status := &unbindv1.ServiceStatus{}
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(statusMap, status); err != nil {
		return nil, fmt.Errorf("failed to convert service status: %w", err)
	}
	return status, nil
}
