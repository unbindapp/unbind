package k8s

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	mocks_config "github.com/unbindapp/unbind-api/mocks/config"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
)

func TestUpdateDeploymentImages(t *testing.T) {
	tests := []struct {
		name            string
		newVersion      string
		deployments     []runtime.Object
		expectedError   bool
		validateUpdates func(t *testing.T, client *fake.Clientset)
	}{
		{
			name:       "Update UI and operator deployments",
			newVersion: "v1.2.3",
			deployments: []runtime.Object{
				&appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "unbind-ui",
						Namespace: "unbind-system",
					},
					Spec: appsv1.DeploymentSpec{
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{
								Containers: []corev1.Container{
									{
										Name:  "ui",
										Image: "ghcr.io/unbindapp/unbind-ui:v1.2.2",
									},
								},
							},
						},
					},
				},
				&appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "unbind-operator",
						Namespace: "unbind-system",
					},
					Spec: appsv1.DeploymentSpec{
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{
								Containers: []corev1.Container{
									{
										Name:  "operator",
										Image: "ghcr.io/unbindapp/unbind-operator:v1.2.2",
									},
								},
							},
						},
					},
				},
			},
			expectedError: false,
			validateUpdates: func(t *testing.T, client *fake.Clientset) {
				// Check UI deployment
				deployment, err := client.AppsV1().Deployments("unbind-system").Get(
					context.Background(), "unbind-ui", metav1.GetOptions{},
				)
				assert.NoError(t, err)
				assert.Equal(t, "ghcr.io/unbindapp/unbind-ui:v1.2.3", deployment.Spec.Template.Spec.Containers[0].Image)

				// Check operator deployment
				deployment, err = client.AppsV1().Deployments("unbind-system").Get(
					context.Background(), "unbind-operator", metav1.GetOptions{},
				)
				assert.NoError(t, err)
				assert.Equal(t, "ghcr.io/unbindapp/unbind-operator:v1.2.3", deployment.Spec.Template.Spec.Containers[0].Image)
			},
		},
		{
			name:       "Update API deployment after others",
			newVersion: "v1.3.0",
			deployments: []runtime.Object{
				&appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "unbind-api",
						Namespace: "unbind-system",
					},
					Spec: appsv1.DeploymentSpec{
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{
								Containers: []corev1.Container{
									{
										Name:  "api",
										Image: "ghcr.io/unbindapp/unbind-api:v1.2.9",
									},
								},
							},
						},
					},
				},
				&appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "unbind-ui",
						Namespace: "unbind-system",
					},
					Spec: appsv1.DeploymentSpec{
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{
								Containers: []corev1.Container{
									{
										Name:  "ui",
										Image: "ghcr.io/unbindapp/unbind-ui:v1.2.9",
									},
								},
							},
						},
					},
				},
			},
			expectedError: false,
			validateUpdates: func(t *testing.T, client *fake.Clientset) {
				// Both should be updated
				apiDeployment, err := client.AppsV1().Deployments("unbind-system").Get(
					context.Background(), "unbind-api", metav1.GetOptions{},
				)
				assert.NoError(t, err)
				assert.Equal(t, "ghcr.io/unbindapp/unbind-api:v1.3.0", apiDeployment.Spec.Template.Spec.Containers[0].Image)

				uiDeployment, err := client.AppsV1().Deployments("unbind-system").Get(
					context.Background(), "unbind-ui", metav1.GetOptions{},
				)
				assert.NoError(t, err)
				assert.Equal(t, "ghcr.io/unbindapp/unbind-ui:v1.3.0", uiDeployment.Spec.Template.Spec.Containers[0].Image)
			},
		},
		{
			name:       "Skip non-unbind deployments",
			newVersion: "v1.4.0",
			deployments: []runtime.Object{
				&appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "nginx-ingress",
						Namespace: "unbind-system",
					},
					Spec: appsv1.DeploymentSpec{
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{
								Containers: []corev1.Container{
									{
										Name:  "nginx",
										Image: "nginx:1.21",
									},
								},
							},
						},
					},
				},
				&appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "unbind-ui",
						Namespace: "unbind-system",
					},
					Spec: appsv1.DeploymentSpec{
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{
								Containers: []corev1.Container{
									{
										Name:  "ui",
										Image: "ghcr.io/unbindapp/unbind-ui:v1.3.9",
									},
								},
							},
						},
					},
				},
			},
			expectedError: false,
			validateUpdates: func(t *testing.T, client *fake.Clientset) {
				// nginx should not be updated
				nginxDeployment, err := client.AppsV1().Deployments("unbind-system").Get(
					context.Background(), "nginx-ingress", metav1.GetOptions{},
				)
				assert.NoError(t, err)
				assert.Equal(t, "nginx:1.21", nginxDeployment.Spec.Template.Spec.Containers[0].Image)

				// unbind-ui should be updated
				uiDeployment, err := client.AppsV1().Deployments("unbind-system").Get(
					context.Background(), "unbind-ui", metav1.GetOptions{},
				)
				assert.NoError(t, err)
				assert.Equal(t, "ghcr.io/unbindapp/unbind-ui:v1.4.0", uiDeployment.Spec.Template.Spec.Containers[0].Image)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fakeClient := fake.NewSimpleClientset(tt.deployments...)

			mockConfig := &mocks_config.ConfigMock{}
			mockConfig.On("GetSystemNamespace").Return("unbind-system")

			kubeClient := &KubeClient{
				clientset: fakeClient,
				config:    mockConfig,
			}

			err := kubeClient.UpdateDeploymentImages(context.Background(), tt.newVersion)

			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				if tt.validateUpdates != nil {
					tt.validateUpdates(t, fakeClient)
				}
			}

			mockConfig.AssertExpectations(t)
		})
	}
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
			name:    "All deployments ready with correct version",
			version: "v1.2.3",
			objects: []runtime.Object{
				// UI Deployment
				&appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "unbind-ui",
						Namespace: "unbind-system",
						Labels: map[string]string{
							"app": "unbind-ui",
						},
					},
					Spec: appsv1.DeploymentSpec{
						Selector: &metav1.LabelSelector{
							MatchLabels: map[string]string{
								"app": "unbind-ui",
							},
						},
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{
								Containers: []corev1.Container{
									{
										Name:  "ui",
										Image: "ghcr.io/unbindapp/unbind-ui:v1.2.3",
									},
								},
							},
						},
					},
				},
				// UI Pod
				&corev1.Pod{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "unbind-ui-pod",
						Namespace: "unbind-system",
						Labels: map[string]string{
							"app": "unbind-ui",
						},
					},
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{
							{
								Name:  "ui",
								Image: "ghcr.io/unbindapp/unbind-ui:v1.2.3",
							},
						},
					},
					Status: corev1.PodStatus{
						Phase: corev1.PodRunning,
					},
				},
				// API Deployment
				&appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "unbind-api",
						Namespace: "unbind-system",
						Labels: map[string]string{
							"app": "unbind-api",
						},
					},
					Spec: appsv1.DeploymentSpec{
						Selector: &metav1.LabelSelector{
							MatchLabels: map[string]string{
								"app": "unbind-api",
							},
						},
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{
								Containers: []corev1.Container{
									{
										Name:  "api",
										Image: "ghcr.io/unbindapp/unbind-api:v1.2.3",
									},
								},
							},
						},
					},
				},
				// API Pod
				&corev1.Pod{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "unbind-api-pod",
						Namespace: "unbind-system",
						Labels: map[string]string{
							"app": "unbind-api",
						},
					},
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{
							{
								Name:  "api",
								Image: "ghcr.io/unbindapp/unbind-api:v1.2.3",
							},
						},
					},
					Status: corev1.PodStatus{
						Phase: corev1.PodRunning,
					},
				},
			},
			expectedReady: true,
			expectedError: false,
		},
		{
			name:    "Deployment with wrong version",
			version: "v1.2.3",
			objects: []runtime.Object{
				&appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "unbind-ui",
						Namespace: "unbind-system",
						Labels: map[string]string{
							"app": "unbind-ui",
						},
					},
					Spec: appsv1.DeploymentSpec{
						Selector: &metav1.LabelSelector{
							MatchLabels: map[string]string{
								"app": "unbind-ui",
							},
						},
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{
								Containers: []corev1.Container{
									{
										Name:  "ui",
										Image: "ghcr.io/unbindapp/unbind-ui:v1.2.2", // Wrong version
									},
								},
							},
						},
					},
				},
				&corev1.Pod{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "unbind-ui-pod",
						Namespace: "unbind-system",
						Labels: map[string]string{
							"app": "unbind-ui",
						},
					},
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{
							{
								Name:  "ui",
								Image: "ghcr.io/unbindapp/unbind-ui:v1.2.2", // Wrong version
							},
						},
					},
					Status: corev1.PodStatus{
						Phase: corev1.PodRunning,
					},
				},
			},
			expectedReady: false,
			expectedError: false,
		},
		{
			name:    "Pod not in running state",
			version: "v1.2.3",
			objects: []runtime.Object{
				&appsv1.Deployment{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "unbind-ui",
						Namespace: "unbind-system",
						Labels: map[string]string{
							"app": "unbind-ui",
						},
					},
					Spec: appsv1.DeploymentSpec{
						Selector: &metav1.LabelSelector{
							MatchLabels: map[string]string{
								"app": "unbind-ui",
							},
						},
						Template: corev1.PodTemplateSpec{
							Spec: corev1.PodSpec{
								Containers: []corev1.Container{
									{
										Name:  "ui",
										Image: "ghcr.io/unbindapp/unbind-ui:v1.2.3",
									},
								},
							},
						},
					},
				},
				&corev1.Pod{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "unbind-ui-pod",
						Namespace: "unbind-system",
						Labels: map[string]string{
							"app": "unbind-ui",
						},
					},
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{
							{
								Name:  "ui",
								Image: "ghcr.io/unbindapp/unbind-ui:v1.2.3",
							},
						},
					},
					Status: corev1.PodStatus{
						Phase: corev1.PodPending, // Not running
					},
				},
			},
			expectedReady: false,
			expectedError: false,
		},
		{
			name:          "No unbind deployments found",
			version:       "v1.2.3",
			objects:       []runtime.Object{},
			expectedReady: false,
			expectedError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fakeClient := fake.NewSimpleClientset(tt.objects...)

			mockConfig := &mocks_config.ConfigMock{}
			mockConfig.On("GetSystemNamespace").Return("unbind-system")

			kubeClient := &KubeClient{
				clientset: fakeClient,
				config:    mockConfig,
			}

			ready, err := kubeClient.CheckDeploymentsReady(context.Background(), tt.version)

			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedReady, ready)
			}

			mockConfig.AssertExpectations(t)
		})
	}
}
