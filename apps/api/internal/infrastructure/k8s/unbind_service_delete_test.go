package k8s

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic/fake"
)

func TestDeleteUnbindService(t *testing.T) {
	// Define the GVR for unbind service
	serviceGVR := schema.GroupVersionResource{
		Group:    "unbind.unbind.app",
		Version:  "v1",
		Resource: "services",
	}

	tests := []struct {
		name              string
		namespace         string
		serviceName       string
		existingResources []runtime.Object
		expectedError     bool
		expectNotFound    bool
	}{
		{
			name:        "Delete existing service",
			namespace:   "test-namespace",
			serviceName: "test-service",
			existingResources: []runtime.Object{
				&unstructured.Unstructured{
					Object: map[string]any{
						"apiVersion": "unbind.unbind.app/v1",
						"kind":       "Service",
						"metadata": map[string]any{
							"name":      "test-service",
							"namespace": "test-namespace",
						},
						"spec": map[string]any{
							"image": "nginx:latest",
						},
					},
				},
			},
			expectedError:  false,
			expectNotFound: false,
		},
		{
			name:              "Delete non-existent service (should not error)",
			namespace:         "test-namespace",
			serviceName:       "non-existent-service",
			existingResources: []runtime.Object{},
			expectedError:     false,
			expectNotFound:    true,
		},
		{
			name:        "Delete service from different namespace",
			namespace:   "other-namespace",
			serviceName: "test-service",
			existingResources: []runtime.Object{
				&unstructured.Unstructured{
					Object: map[string]any{
						"apiVersion": "unbind.unbind.app/v1",
						"kind":       "Service",
						"metadata": map[string]any{
							"name":      "test-service",
							"namespace": "test-namespace", // Different namespace
						},
						"spec": map[string]any{
							"image": "nginx:latest",
						},
					},
				},
			},
			expectedError:  false,
			expectNotFound: true, // Won't find it in the other namespace
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create fake dynamic client with existing resources
			scheme := runtime.NewScheme()
			fakeDynamicClient := fake.NewSimpleDynamicClient(scheme, tt.existingResources...)

			kubeClient := &KubeClient{
				client: fakeDynamicClient,
			}

			err := kubeClient.DeleteUnbindService(context.Background(), tt.namespace, tt.serviceName)

			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)

				// Verify the resource was actually deleted (or was not found)
				_, getErr := fakeDynamicClient.Resource(serviceGVR).Namespace(tt.namespace).Get(
					context.Background(),
					tt.serviceName,
					metav1.GetOptions{},
				)

				if tt.expectNotFound {
					// Should be not found
					assert.True(t, errors.IsNotFound(getErr), "Expected resource to be not found")
				} else {
					// Should be not found because it was deleted
					assert.True(t, errors.IsNotFound(getErr), "Expected resource to be deleted")
				}
			}
		})
	}
}

func TestDeleteUnbindService_EdgeCases(t *testing.T) {
	t.Run("Empty namespace", func(t *testing.T) {
		scheme := runtime.NewScheme()
		fakeDynamicClient := fake.NewSimpleDynamicClient(scheme)

		kubeClient := &KubeClient{
			client: fakeDynamicClient,
		}

		err := kubeClient.DeleteUnbindService(context.Background(), "", "test-service")
		assert.NoError(t, err) // Should handle gracefully
	})

	t.Run("Empty service name", func(t *testing.T) {
		scheme := runtime.NewScheme()
		fakeDynamicClient := fake.NewSimpleDynamicClient(scheme)

		kubeClient := &KubeClient{
			client: fakeDynamicClient,
		}

		err := kubeClient.DeleteUnbindService(context.Background(), "test-namespace", "")
		assert.NoError(t, err) // Should handle gracefully
	})
}
