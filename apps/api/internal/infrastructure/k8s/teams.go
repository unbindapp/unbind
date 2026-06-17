package k8s

// ? "Team" is synonymous with a Kubernetes namespace

import (
	"context"
	"fmt"

	"github.com/unbindapp/unbind-api/internal/common/log"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// Gets specified namespaces
func (k *KubeClient) GetNamespaces(ctx context.Context, namespaceNames []string, bearerToken string) ([]*corev1.Namespace, error) {
	client, err := k.CreateClientWithToken(bearerToken)
	if err != nil {
		log.Errorf("Error creating client with token: %v", err)
		return nil, fmt.Errorf("error creating client with token: %v", err)
	}

	namespaces := make([]*corev1.Namespace, 0, len(namespaceNames))

	// Get each namespace by name instead of listing all
	for i, namespaceName := range namespaceNames {
		// Skip empty namespace names
		if namespaceName == "" {
			continue
		}

		// Get the specific namespace
		ns, err := client.CoreV1().Namespaces().Get(ctx, namespaceName, metav1.GetOptions{})
		if err != nil {
			// Log the error but continue with other namespaces
			log.Warnf("Error getting namespace %s: %v", namespaceName, err)
			continue
		}

		namespaces[i] = ns
	}

	return namespaces, nil
}

// CreateNamespace creates a new namespace in the Kubernetes cluster
func (k *KubeClient) CreateNamespace(ctx context.Context, namespaceName string, client kubernetes.Interface) (*corev1.Namespace, error) {
	// Define the namespace object
	namespace := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: namespaceName,
		},
	}

	// Create the namespace
	createdNamespace, err := client.CoreV1().Namespaces().Create(ctx, namespace, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Error creating namespace %s: %v", namespaceName, err)
		return nil, fmt.Errorf("error creating namespace %s: %v", namespaceName, err)
	}

	log.Infof("Successfully created namespace: %s", namespaceName)
	return createdNamespace, nil
}
