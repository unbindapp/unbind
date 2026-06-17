package k8s

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/internal/models"
	mocks_config "github.com/unbindapp/unbind-api/mocks/config"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
)

func TestIsCertificateIssued(t *testing.T) {
	tests := []struct {
		name     string
		secret   *corev1.Secret
		expected bool
	}{
		{
			name:     "Nil secret",
			secret:   nil,
			expected: false,
		},
		{
			name: "Secret without TLS data",
			secret: &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-secret",
				},
				Data: map[string][]byte{
					"other": []byte("data"),
				},
			},
			expected: false,
		},
		{
			name: "Secret with empty TLS cert",
			secret: &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-secret",
					Annotations: map[string]string{
						"cert-manager.io/issuer": "test-issuer",
					},
				},
				Data: map[string][]byte{
					"tls.crt": []byte(""),
					"tls.key": []byte("test-key"),
				},
			},
			expected: false,
		},
		{
			name: "Secret with valid TLS data but no cert-manager annotation",
			secret: &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-secret",
				},
				Data: map[string][]byte{
					"tls.crt": []byte("test-cert"),
					"tls.key": []byte("test-key"),
				},
			},
			expected: false,
		},
		{
			name: "Valid issued certificate",
			secret: &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-secret",
					Annotations: map[string]string{
						"cert-manager.io/issuer": "test-issuer",
					},
				},
				Data: map[string][]byte{
					"tls.crt": []byte("test-cert"),
					"tls.key": []byte("test-key"),
				},
			},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isCertificateIssued(tt.secret)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestDiscoverEndpointsByLabels(t *testing.T) {
	teamID := uuid.New()
	projectID := uuid.New()
	environmentID := uuid.New()
	serviceID := uuid.New()

	tests := []struct {
		name           string
		labels         map[string]string
		objects        []runtime.Object
		expectedError  bool
		validateResult func(t *testing.T, result *models.EndpointDiscovery)
	}{
		{
			name: "No resources found",
			labels: map[string]string{
				"app": "nonexistent",
			},
			objects:       []runtime.Object{},
			expectedError: false,
			validateResult: func(t *testing.T, result *models.EndpointDiscovery) {
				assert.Empty(t, result.Internal)
				assert.Empty(t, result.External)
			},
		},
		{
			name: "ClusterIP service discovery",
			labels: map[string]string{
				"app": "web-server",
			},
			objects: []runtime.Object{
				&corev1.Service{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "web-service",
						Namespace: "default",
						Labels: map[string]string{
							"app":                "web-server",
							"unbind-team":        teamID.String(),
							"unbind-project":     projectID.String(),
							"unbind-environment": environmentID.String(),
							"unbind-service":     serviceID.String(),
						},
					},
					Spec: corev1.ServiceSpec{
						Type: corev1.ServiceTypeClusterIP,
						Ports: []corev1.ServicePort{
							{
								Port:     80,
								Protocol: corev1.ProtocolTCP,
							},
							{
								Port:     443,
								Protocol: corev1.ProtocolTCP,
							},
						},
					},
				},
			},
			expectedError: false,
			validateResult: func(t *testing.T, result *models.EndpointDiscovery) {
				require.Len(t, result.Internal, 1)
				assert.Empty(t, result.External)

				service := result.Internal[0]
				assert.Equal(t, "web-service", service.KubernetesName)
				assert.Equal(t, "web-service.default", service.DNS)
				assert.Equal(t, teamID, service.TeamID)
				assert.Equal(t, projectID, service.ProjectID)
				assert.Equal(t, environmentID, service.EnvironmentID)
				assert.Equal(t, serviceID, service.ServiceID)
				assert.Len(t, service.Ports, 2)
				assert.Equal(t, int32(80), service.Ports[0].Port)
				assert.Equal(t, int32(443), service.Ports[1].Port)
			},
		},
		{
			name: "Ingress discovery with TLS",
			labels: map[string]string{
				"app": "web-app",
			},
			objects: []runtime.Object{
				&networkingv1.Ingress{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "web-ingress",
						Namespace: "default",
						Labels: map[string]string{
							"app":                "web-app",
							"unbind-team":        teamID.String(),
							"unbind-project":     projectID.String(),
							"unbind-environment": environmentID.String(),
							"unbind-service":     serviceID.String(),
						},
					},
					Spec: networkingv1.IngressSpec{
						Rules: []networkingv1.IngressRule{
							{
								Host: "example.com",
								IngressRuleValue: networkingv1.IngressRuleValue{
									HTTP: &networkingv1.HTTPIngressRuleValue{
										Paths: []networkingv1.HTTPIngressPath{
											{
												Path: "/api",
												Backend: networkingv1.IngressBackend{
													Service: &networkingv1.IngressServiceBackend{
														Name: "api-service",
														Port: networkingv1.ServiceBackendPort{
															Number: 8080,
														},
													},
												},
											},
										},
									},
								},
							},
						},
						TLS: []networkingv1.IngressTLS{
							{
								Hosts:      []string{"example.com"},
								SecretName: "example-tls",
							},
						},
					},
				},
				&corev1.Secret{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "example-tls",
						Namespace: "default",
						Annotations: map[string]string{
							"cert-manager.io/issuer": "letsencrypt",
						},
					},
					Data: map[string][]byte{
						"tls.crt": []byte("cert-data"),
						"tls.key": []byte("key-data"),
					},
				},
			},
			expectedError: false,
			validateResult: func(t *testing.T, result *models.EndpointDiscovery) {
				assert.Empty(t, result.Internal)
				require.Len(t, result.External, 1)

				endpoint := result.External[0]
				assert.Equal(t, "web-ingress", endpoint.KubernetesName)
				assert.True(t, endpoint.IsIngress)
				assert.Equal(t, "example.com", endpoint.Host)
				assert.Equal(t, "/api", endpoint.Path)
				assert.Equal(t, models.TlsStatusIssued, endpoint.TlsStatus)
				assert.Equal(t, models.DNSStatusResolved, endpoint.DNSStatus)
				assert.Equal(t, teamID, endpoint.TeamID)
				assert.Equal(t, projectID, endpoint.ProjectID)
				assert.Equal(t, environmentID, endpoint.EnvironmentID)
				assert.Equal(t, serviceID, endpoint.ServiceID)
				assert.NotNil(t, endpoint.TargetPort)
				assert.Equal(t, int32(8080), endpoint.TargetPort.Port)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fakeClient := fake.NewSimpleClientset(tt.objects...)

			// Create a KubeClient with minimal config
			kubeClient := &KubeClient{}

			result, err := kubeClient.DiscoverEndpointsByLabels(
				context.Background(),
				"default",
				tt.labels,
				false, // Don't check DNS for these tests
				fakeClient,
			)

			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				require.NotNil(t, result)
				tt.validateResult(t, result)
			}
		})
	}
}

func TestCreateVerificationIngress(t *testing.T) {
	tests := []struct {
		name          string
		domain        string
		expectedError bool
	}{
		{
			name:          "Valid domain",
			domain:        "example.com",
			expectedError: false,
		},
		{
			name:          "Domain with subdomain",
			domain:        "app.example.com",
			expectedError: false,
		},
		{
			name:          "Domain with special characters",
			domain:        "test-app.example.com",
			expectedError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fakeClient := fake.NewSimpleClientset()

			// Mock config
			mockConfig := &mocks_config.ConfigMock{}
			mockConfig.On("GetSystemNamespace").Return("unbind-system")

			kubeClient := &KubeClient{
				config: mockConfig,
			}

			ingress, path, err := kubeClient.CreateVerificationIngress(
				context.Background(),
				tt.domain,
				fakeClient,
			)

			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				require.NotNil(t, ingress)
				assert.NotEmpty(t, path)

				// Verify ingress properties
				assert.Equal(t, "unbind-system", ingress.Namespace)
				assert.Equal(t, "unbind-verification", ingress.Labels["app"])
				assert.Equal(t, "domain-verification", ingress.Labels["type"])
				assert.Equal(t, tt.domain, ingress.Labels["domain"])
				assert.Equal(t, "true", ingress.Labels["temporary"])

				// Verify ingress spec
				require.Len(t, ingress.Spec.Rules, 1)
				assert.Equal(t, tt.domain, ingress.Spec.Rules[0].Host)
				assert.NotNil(t, ingress.Spec.IngressClassName)
				assert.Equal(t, "nginx", *ingress.Spec.IngressClassName)

				// Verify annotations
				assert.Contains(t, ingress.Annotations, "nginx.ingress.kubernetes.io/ssl-redirect")
				assert.Contains(t, ingress.Annotations, "nginx.ingress.kubernetes.io/configuration-snippet")
			}

			mockConfig.AssertExpectations(t)
		})
	}
}

func TestDeleteVerificationIngress(t *testing.T) {
	tests := []struct {
		name          string
		ingressName   string
		setupObjects  []runtime.Object
		expectedError bool
	}{
		{
			name:        "Delete existing ingress",
			ingressName: "test-ingress",
			setupObjects: []runtime.Object{
				&networkingv1.Ingress{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-ingress",
						Namespace: "unbind-system",
					},
				},
			},
			expectedError: false,
		},
		{
			name:          "Delete non-existent ingress",
			ingressName:   "nonexistent-ingress",
			setupObjects:  []runtime.Object{},
			expectedError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fakeClient := fake.NewSimpleClientset(tt.setupObjects...)

			mockConfig := &mocks_config.ConfigMock{}
			mockConfig.On("GetSystemNamespace").Return("unbind-system")

			kubeClient := &KubeClient{
				config: mockConfig,
			}

			err := kubeClient.DeleteVerificationIngress(
				context.Background(),
				tt.ingressName,
				fakeClient,
			)

			if tt.expectedError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)

				// Verify ingress was deleted
				_, err := fakeClient.NetworkingV1().Ingresses("unbind-system").Get(
					context.Background(),
					tt.ingressName,
					metav1.GetOptions{},
				)
				assert.Error(t, err) // Should be NotFound error
			}

			mockConfig.AssertExpectations(t)
		})
	}
}

func TestDeleteOldVerificationIngresses(t *testing.T) {
	now := time.Now()
	oldTime := now.Add(-15 * time.Minute)   // 15 minutes ago
	recentTime := now.Add(-5 * time.Minute) // 5 minutes ago

	objects := []runtime.Object{
		// Old ingress (should be deleted)
		&networkingv1.Ingress{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "old-verification",
				Namespace: "unbind-system",
				Labels: map[string]string{
					"app":       "unbind-verification",
					"type":      "domain-verification",
					"temporary": "true",
				},
				CreationTimestamp: metav1.Time{Time: oldTime},
			},
		},
		// Recent ingress (should not be deleted)
		&networkingv1.Ingress{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "recent-verification",
				Namespace: "unbind-system",
				Labels: map[string]string{
					"app":       "unbind-verification",
					"type":      "domain-verification",
					"temporary": "true",
				},
				CreationTimestamp: metav1.Time{Time: recentTime},
			},
		},
		// Different app (should not be deleted)
		&networkingv1.Ingress{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "other-app",
				Namespace: "unbind-system",
				Labels: map[string]string{
					"app": "other-app",
				},
				CreationTimestamp: metav1.Time{Time: oldTime},
			},
		},
	}

	fakeClient := fake.NewSimpleClientset(objects...)

	mockConfig := &mocks_config.ConfigMock{}
	mockConfig.On("GetSystemNamespace").Return("unbind-system")

	kubeClient := &KubeClient{
		config: mockConfig,
	}

	err := kubeClient.DeleteOldVerificationIngresses(
		context.Background(),
		fakeClient,
	)
	assert.NoError(t, err)

	// Verify old verification ingress was deleted
	_, err = fakeClient.NetworkingV1().Ingresses("unbind-system").Get(
		context.Background(),
		"old-verification",
		metav1.GetOptions{},
	)
	assert.Error(t, err) // Should be NotFound

	// Verify recent verification ingress still exists
	_, err = fakeClient.NetworkingV1().Ingresses("unbind-system").Get(
		context.Background(),
		"recent-verification",
		metav1.GetOptions{},
	)
	assert.NoError(t, err)

	// Verify other app ingress still exists
	_, err = fakeClient.NetworkingV1().Ingresses("unbind-system").Get(
		context.Background(),
		"other-app",
		metav1.GetOptions{},
	)
	assert.NoError(t, err)

	mockConfig.AssertExpectations(t)
}
