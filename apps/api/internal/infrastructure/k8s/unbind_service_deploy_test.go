package k8s

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	unbindv1 "github.com/unbindapp/unbind-operator/api/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/dynamic/fake"
)

func TestDeployUnbindService_Create(t *testing.T) {
	service := &unbindv1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-service",
			Namespace: "test-namespace",
		},
		Spec: unbindv1.ServiceSpec{},
	}

	scheme := runtime.NewScheme()
	fakeDynamicClient := fake.NewSimpleDynamicClient(scheme)

	kubeClient := &KubeClient{
		client: fakeDynamicClient,
	}

	createdCR, returnedService, err := kubeClient.DeployUnbindService(context.Background(), service)

	assert.NoError(t, err)
	require.NotNil(t, createdCR)
	require.NotNil(t, returnedService)

	// Verify the returned service matches input
	assert.Equal(t, service.Name, returnedService.Name)
	assert.Equal(t, service.Namespace, returnedService.Namespace)

	// Verify the resource was created
	assert.Equal(t, "test-service", createdCR.GetName())
	assert.Equal(t, "test-namespace", createdCR.GetNamespace())
}

func TestDeployUnbindService_Update(t *testing.T) {
	existingResource := &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "unbind.unbind.app/v1",
			"kind":       "Service",
			"metadata": map[string]any{
				"name":            "existing-service",
				"namespace":       "test-namespace",
				"resourceVersion": "123",
			},
			"spec": map[string]any{
				"enabled": true,
			},
		},
	}

	service := &unbindv1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "existing-service",
			Namespace: "test-namespace",
		},
		Spec: unbindv1.ServiceSpec{},
	}

	scheme := runtime.NewScheme()
	fakeDynamicClient := fake.NewSimpleDynamicClient(scheme, existingResource)

	kubeClient := &KubeClient{
		client: fakeDynamicClient,
	}

	updatedCR, returnedService, err := kubeClient.DeployUnbindService(context.Background(), service)

	assert.NoError(t, err)
	require.NotNil(t, updatedCR)
	require.NotNil(t, returnedService)

	// Verify the service was updated
	assert.Equal(t, service.Name, returnedService.Name)
	assert.Equal(t, service.Namespace, returnedService.Namespace)
}

func TestConvertToUnstructured_Basic(t *testing.T) {
	service := &unbindv1.Service{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "unbind.unbind.app/v1",
			Kind:       "Service",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-service",
			Namespace: "test-namespace",
			Labels: map[string]string{
				"app": "test-app",
			},
		},
		Spec: unbindv1.ServiceSpec{},
	}

	unstructuredObj, err := convertToUnstructured(service)

	assert.NoError(t, err)
	require.NotNil(t, unstructuredObj)

	// Verify basic fields
	assert.Equal(t, service.Name, unstructuredObj.GetName())
	assert.Equal(t, service.Namespace, unstructuredObj.GetNamespace())
	assert.Equal(t, service.APIVersion, unstructuredObj.GetAPIVersion())
	assert.Equal(t, service.Kind, unstructuredObj.GetKind())

	// Verify labels
	labels := unstructuredObj.GetLabels()
	assert.Equal(t, "test-app", labels["app"])
}

func TestConvertToUnstructured_NilService(t *testing.T) {
	_, err := convertToUnstructured(nil)
	assert.Error(t, err)
}

func TestDeployUnbindService_EmptyNamespace(t *testing.T) {
	service := &unbindv1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-service",
			// No namespace specified
		},
		Spec: unbindv1.ServiceSpec{},
	}

	scheme := runtime.NewScheme()
	fakeDynamicClient := fake.NewSimpleDynamicClient(scheme)

	kubeClient := &KubeClient{
		client: fakeDynamicClient,
	}

	createdCR, returnedService, err := kubeClient.DeployUnbindService(context.Background(), service)

	assert.NoError(t, err)
	require.NotNil(t, createdCR)
	require.NotNil(t, returnedService)

	// Verify the service was created
	assert.Equal(t, service.Name, returnedService.Name)
}
