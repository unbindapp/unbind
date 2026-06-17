package k8s

import (
	"context"
	"fmt"

	"github.com/charmbracelet/log"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// Delete a custom unbind service CRD
func (k *KubeClient) DeleteUnbindService(ctx context.Context, namespace, name string) error {
	// Define the GVR for the unbind service resource
	resourceGVR := schema.GroupVersionResource{
		Group:    "unbind.unbind.app",
		Version:  "v1",
		Resource: "services",
	}

	// Delete the specific resource
	err := k.client.Resource(resourceGVR).Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			// Resource doesn't exist, which is fine
			log.Infof("Service %s in namespace %s not found, might already be deleted", name, namespace)
			return nil
		}
		return fmt.Errorf("failed to delete service %s in namespace %s: %w", name, namespace, err)
	}

	log.Infof("Successfully deleted service %s in namespace %s", name, namespace)
	return nil
}
