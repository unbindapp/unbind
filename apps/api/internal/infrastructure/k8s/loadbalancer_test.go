package k8s

import (
	"testing"

	"github.com/stretchr/testify/assert"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestLoadBalancerAddresses_StructCreation(t *testing.T) {
	// Test creating LoadBalancerAddresses struct
	addresses := LoadBalancerAddresses{
		Name:      "test-service",
		Namespace: "test-namespace",
		IPv4:      "192.168.1.100",
		IPv6:      "2001:db8::1",
		Hostname:  "test.example.com",
	}

	assert.Equal(t, "test-service", addresses.Name)
	assert.Equal(t, "test-namespace", addresses.Namespace)
	assert.Equal(t, "192.168.1.100", addresses.IPv4)
	assert.Equal(t, "2001:db8::1", addresses.IPv6)
	assert.Equal(t, "test.example.com", addresses.Hostname)
}

func TestLoadBalancerAddresses_EmptyFields(t *testing.T) {
	// Test creating LoadBalancerAddresses with empty fields
	addresses := LoadBalancerAddresses{}

	assert.Empty(t, addresses.Name)
	assert.Empty(t, addresses.Namespace)
	assert.Empty(t, addresses.IPv4)
	assert.Empty(t, addresses.IPv6)
	assert.Empty(t, addresses.Hostname)
}

func TestIsIPv6(t *testing.T) {
	tests := []struct {
		name     string
		ip       string
		expected bool
	}{
		{
			name:     "Valid IPv6 address",
			ip:       "2001:db8::1",
			expected: true,
		},
		{
			name:     "Valid IPv6 full address",
			ip:       "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
			expected: true,
		},
		{
			name:     "IPv4 address",
			ip:       "192.168.1.1",
			expected: false,
		},
		{
			name:     "Empty string",
			ip:       "",
			expected: false,
		},
		{
			name:     "Invalid IP",
			ip:       "not-an-ip",
			expected: false,
		},
		{
			name:     "Localhost IPv6",
			ip:       "::1",
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isIPv6(tt.ip)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestKubeClient_LoadBalancerMethodsExist(t *testing.T) {
	kubeClient := &KubeClient{}

	// Test that loadbalancer methods exist
	assert.NotNil(t, kubeClient.GetLoadBalancerIPs)
	assert.NotNil(t, kubeClient.GetIngressNginxIP)
	assert.NotNil(t, kubeClient.GetUnusedNodePort)
}

func TestLoadBalancerService_StructCreation(t *testing.T) {
	// Test creating a service that would be used by the loadbalancer methods
	service := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-lb-service",
			Namespace: "test-namespace",
			Labels: map[string]string{
				"app.kubernetes.io/name": "ingress-nginx",
			},
		},
		Spec: corev1.ServiceSpec{
			Type: corev1.ServiceTypeLoadBalancer,
			Ports: []corev1.ServicePort{
				{
					Port:     80,
					Protocol: corev1.ProtocolTCP,
				},
			},
		},
		Status: corev1.ServiceStatus{
			LoadBalancer: corev1.LoadBalancerStatus{
				Ingress: []corev1.LoadBalancerIngress{
					{
						IP:       "192.168.1.100",
						Hostname: "test.example.com",
					},
				},
			},
		},
	}

	assert.Equal(t, "test-lb-service", service.Name)
	assert.Equal(t, "test-namespace", service.Namespace)
	assert.Equal(t, corev1.ServiceTypeLoadBalancer, service.Spec.Type)
	assert.Equal(t, "ingress-nginx", service.Labels["app.kubernetes.io/name"])
	assert.Len(t, service.Status.LoadBalancer.Ingress, 1)
	assert.Equal(t, "192.168.1.100", service.Status.LoadBalancer.Ingress[0].IP)
	assert.Equal(t, "test.example.com", service.Status.LoadBalancer.Ingress[0].Hostname)
}

func TestLoadBalancerIngress_MultipleAddresses(t *testing.T) {
	// Test service with multiple ingress addresses (IPv4 and IPv6)
	service := &corev1.Service{
		Status: corev1.ServiceStatus{
			LoadBalancer: corev1.LoadBalancerStatus{
				Ingress: []corev1.LoadBalancerIngress{
					{
						IP: "192.168.1.100", // IPv4
					},
					{
						IP: "2001:db8::1", // IPv6
					},
				},
			},
		},
	}

	assert.Len(t, service.Status.LoadBalancer.Ingress, 2)

	// First ingress should be IPv4
	firstIngress := service.Status.LoadBalancer.Ingress[0]
	assert.Equal(t, "192.168.1.100", firstIngress.IP)
	assert.False(t, isIPv6(firstIngress.IP))

	// Second ingress should be IPv6
	secondIngress := service.Status.LoadBalancer.Ingress[1]
	assert.Equal(t, "2001:db8::1", secondIngress.IP)
	assert.True(t, isIPv6(secondIngress.IP))
}

func TestLoadBalancerAnnotations(t *testing.T) {
	// Test service with IPv6 annotation
	service := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Annotations: map[string]string{
				"ipv6.kubernetes.io/address": "2001:db8::2",
			},
		},
	}

	assert.Equal(t, "2001:db8::2", service.Annotations["ipv6.kubernetes.io/address"])
}
