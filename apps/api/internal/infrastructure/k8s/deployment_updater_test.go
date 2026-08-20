package k8s

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	mocks_config "github.com/unbindapp/unbind-api/mocks/config"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"
)

const testNamespace = "unbind-system"

func testDeployment(name, image string) *appsv1.Deployment {
	labels := map[string]string{"app": name}
	return &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: testNamespace, Labels: labels},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{MatchLabels: labels},
			Template: corev1.PodTemplateSpec{
				Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: name, Image: image}}},
			},
		},
	}
}

func testPod(deploymentName, image string, phase corev1.PodPhase) *corev1.Pod {
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: deploymentName + "-pod", Namespace: testNamespace, Labels: map[string]string{"app": deploymentName}},
		Spec:       corev1.PodSpec{Containers: []corev1.Container{{Name: deploymentName, Image: image}}},
		Status:     corev1.PodStatus{Phase: phase},
	}
}

func testKubeClient(t *testing.T, objects ...runtime.Object) (*KubeClient, *fake.Clientset) {
	t.Helper()
	mockConfig := &mocks_config.ConfigMock{}
	mockConfig.On("GetSystemNamespace").Return(testNamespace)
	fakeClient := fake.NewSimpleClientset(objects...)
	return &KubeClient{clientset: fakeClient, config: mockConfig}, fakeClient
}

func deploymentImage(t *testing.T, client *fake.Clientset, name string) string {
	t.Helper()
	deployment, err := client.AppsV1().Deployments(testNamespace).Get(context.Background(), name, metav1.GetOptions{})
	require.NoError(t, err)
	return deployment.Spec.Template.Spec.Containers[0].Image
}

func TestUpdateDeploymentImages(t *testing.T) {
	tests := []struct {
		name        string
		newVersion  string
		deployments []runtime.Object
		expected    map[string]string
	}{
		{
			name:       "retags app and operator",
			newVersion: "v1.2.3",
			deployments: []runtime.Object{
				testDeployment("unbind-api-deployment", "ghcr.io/unbindapp/unbind:v1.2.2"),
				testDeployment("unbind-operator-controller-manager", "ghcr.io/unbindapp/unbind-operator:v1.2.2"),
			},
			expected: map[string]string{
				"unbind-api-deployment":              "ghcr.io/unbindapp/unbind:v1.2.3",
				"unbind-operator-controller-manager": "ghcr.io/unbindapp/unbind-operator:v1.2.3",
			},
		},
		{
			name:       "leaves other images alone",
			newVersion: "v1.4.0",
			deployments: []runtime.Object{
				testDeployment("nginx-ingress", "nginx:1.21"),
				testDeployment("unbind-challenge-responder", "nginx:1.27-alpine"),
				testDeployment("unbind-api-deployment", "ghcr.io/unbindapp/unbind:v1.3.9"),
			},
			expected: map[string]string{
				"nginx-ingress":              "nginx:1.21",
				"unbind-challenge-responder": "nginx:1.27-alpine",
				"unbind-api-deployment":      "ghcr.io/unbindapp/unbind:v1.4.0",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			kubeClient, fakeClient := testKubeClient(t, tt.deployments...)

			require.NoError(t, kubeClient.UpdateDeploymentImages(context.Background(), tt.newVersion))

			for name, image := range tt.expected {
				assert.Equal(t, image, deploymentImage(t, fakeClient, name), name)
			}
		})
	}
}

func TestUpdateDeploymentImages_AppRollsLast(t *testing.T) {
	kubeClient, fakeClient := testKubeClient(t,
		testDeployment("unbind-api-deployment", "ghcr.io/unbindapp/unbind:v1.0.0"),
		testDeployment("unbind-operator-controller-manager", "ghcr.io/unbindapp/unbind-operator:v1.0.0"),
	)

	var updated []string
	fakeClient.PrependReactor("update", "deployments", func(action k8stesting.Action) (bool, runtime.Object, error) {
		updated = append(updated, action.(k8stesting.UpdateAction).GetObject().(*appsv1.Deployment).Name)
		return false, nil, nil
	})

	require.NoError(t, kubeClient.UpdateDeploymentImages(context.Background(), "v1.0.1"))

	assert.Equal(t, []string{"unbind-operator-controller-manager", "unbind-api-deployment"}, updated)
	assert.Equal(t, "ghcr.io/unbindapp/unbind:v1.0.1", deploymentImage(t, fakeClient, "unbind-api-deployment"))
	assert.Equal(t, "ghcr.io/unbindapp/unbind-operator:v1.0.1", deploymentImage(t, fakeClient, "unbind-operator-controller-manager"))
}

func TestCheckDeploymentsReady(t *testing.T) {
	tests := []struct {
		name          string
		version       string
		objects       []runtime.Object
		expectedReady bool
		expectedError bool
	}{
		{
			name:    "all deployments ready on the target version",
			version: "v1.2.3",
			objects: []runtime.Object{
				testDeployment("unbind-api-deployment", "ghcr.io/unbindapp/unbind:v1.2.3"),
				testPod("unbind-api-deployment", "ghcr.io/unbindapp/unbind:v1.2.3", corev1.PodRunning),
				testDeployment("unbind-operator-controller-manager", "ghcr.io/unbindapp/unbind-operator:v1.2.3"),
				testPod("unbind-operator-controller-manager", "ghcr.io/unbindapp/unbind-operator:v1.2.3", corev1.PodRunning),
			},
			expectedReady: true,
		},
		{
			name:    "pod still on the old version",
			version: "v1.2.3",
			objects: []runtime.Object{
				testDeployment("unbind-api-deployment", "ghcr.io/unbindapp/unbind:v1.2.3"),
				testPod("unbind-api-deployment", "ghcr.io/unbindapp/unbind:v1.2.2", corev1.PodRunning),
			},
			expectedReady: false,
		},
		{
			name:    "pod not running",
			version: "v1.2.3",
			objects: []runtime.Object{
				testDeployment("unbind-api-deployment", "ghcr.io/unbindapp/unbind:v1.2.3"),
				testPod("unbind-api-deployment", "ghcr.io/unbindapp/unbind:v1.2.3", corev1.PodPending),
			},
			expectedReady: false,
		},
		{
			name:          "no unbind deployments",
			version:       "v1.2.3",
			objects:       []runtime.Object{testDeployment("nginx-ingress", "nginx:1.21")},
			expectedError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			kubeClient, _ := testKubeClient(t, tt.objects...)

			ready, err := kubeClient.CheckDeploymentsReady(context.Background(), tt.version)

			if tt.expectedError {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.expectedReady, ready)
		})
	}
}
