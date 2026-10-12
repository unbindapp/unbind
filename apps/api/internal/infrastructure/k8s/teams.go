package k8s

// ? "Team" is synonymous with a Kubernetes namespace

import (
	"context"
	"fmt"

	"github.com/unbindapp/unbind-api/internal/common/log"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// CreateNamespace creates a new namespace in the Kubernetes cluster
func (k *KubeClient) CreateNamespace(ctx context.Context, namespaceName string, client kubernetes.Interface) (*corev1.Namespace, error) {
	namespace := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: namespaceName,
		},
	}

	createdNamespace, err := client.CoreV1().Namespaces().Create(ctx, namespace, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Error creating namespace %s: %v", namespaceName, err)
		return nil, fmt.Errorf("error creating namespace %s: %v", namespaceName, err)
	}

	log.Infof("Successfully created namespace: %s", namespaceName)
	return createdNamespace, nil
}

// DeleteNamespace removes a team namespace and everything in it. Deletion is
// asynchronous on the cluster side; a namespace that is already gone is not an error.
func (k *KubeClient) DeleteNamespace(ctx context.Context, namespaceName string, client kubernetes.Interface) error {
	err := client.CoreV1().Namespaces().Delete(ctx, namespaceName, metav1.DeleteOptions{})
	if err != nil && !errors.IsNotFound(err) {
		return fmt.Errorf("error deleting namespace %s: %w", namespaceName, err)
	}
	return nil
}
