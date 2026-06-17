package k8s

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/unbindapp/unbind-api/internal/common/log"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

// LoadBalancerAddresses contains the addresses for a load balancer service
type LoadBalancerAddresses struct {
	Name      string
	Namespace string
	IPv4      string
	IPv6      string
	Hostname  string
}

// GetLoadBalancerIPs returns the external IP addresses for load balancer services
// If labelSelector is provided, it will filter services based on the selector (e.g. "app.kubernetes.io/name=ingress-nginx")
func (self *KubeClient) GetLoadBalancerIPs(ctx context.Context, labelSelector string) ([]LoadBalancerAddresses, error) {
	var addresses []LoadBalancerAddresses

	// Get all services across all namespaces in a single API call
	services, err := self.clientset.CoreV1().Services("").List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list services: %w", err)
	}

	for _, svc := range services.Items {
		lbAddrs := LoadBalancerAddresses{
			Name:      svc.Name,
			Namespace: svc.Namespace,
		}

		// Extract IP addresses from ingress
		if len(svc.Status.LoadBalancer.Ingress) > 0 {
			ingress := svc.Status.LoadBalancer.Ingress[0]

			// Set IPv4 if available
			if ingress.IP != "" {
				lbAddrs.IPv4 = ingress.IP
			}

			// For IPv6, we need to check the annotations or additional data
			// Some cloud providers add IPv6 as an annotation
			if v6IP, ok := svc.Annotations["ipv6.kubernetes.io/address"]; ok {
				lbAddrs.IPv6 = v6IP
			}

			// Alternatively, check for dual-stack IPs by looking at all ingress entries
			if lbAddrs.IPv6 == "" && len(svc.Status.LoadBalancer.Ingress) > 1 {
				for _, ing := range svc.Status.LoadBalancer.Ingress {
					// If we already have an IPv4 and this is a different IP, it might be IPv6
					if ing.IP != "" && ing.IP != lbAddrs.IPv4 && isIPv6(ing.IP) {
						lbAddrs.IPv6 = ing.IP
						break
					}
				}
			}

			// Set hostname if available (for providers like AWS)
			if ingress.Hostname != "" {
				lbAddrs.Hostname = ingress.Hostname
			}
		}

		addresses = append(addresses, lbAddrs)
	}

	return addresses, nil
}

// isIPv6 checks if the given IP address is an IPv6 address
func isIPv6(ip string) bool {
	return strings.Count(ip, ":") >= 2
}

// GetIngressNginxIP is a convenience function to get the IP of the ingress-nginx controller
func (self *KubeClient) GetIngressNginxIP(ctx context.Context) (*LoadBalancerAddresses, error) {
	// Common label for ingress-nginx controller
	labelSelector := "app.kubernetes.io/name=ingress-nginx"

	addresses, err := self.GetLoadBalancerIPs(ctx, labelSelector)
	if err != nil {
		return nil, err
	}

	// Filter further for the controller service if needed
	for _, addr := range addresses {
		if addr.Name == "ingress-nginx-controller" {
			return &addr, nil
		}
	}

	// If we didn't find the specific controller name, return the first match if available
	if len(addresses) > 0 {
		return &addresses[0], nil
	}

	return nil, fmt.Errorf("no ingress-nginx load balancer found")
}

// GetUnusedNodePort returns an unused NodePort, determined by letting kubernetes allocate one then deleting the temp service
func (self *KubeClient) GetUnusedNodePort(ctx context.Context) (int32, error) {
	// Create a temporary service to get an allocated NodePort
	tempSvc := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("temp-nodeport-%d", time.Now().UnixNano()),
			Namespace: self.config.GetSystemNamespace(),
		},
		Spec: corev1.ServiceSpec{
			Type: corev1.ServiceTypeNodePort,
			Ports: []corev1.ServicePort{
				{
					Port:       80,
					TargetPort: intstr.FromInt(80),
				},
			},
		},
	}

	// Create the service
	createdSvc, err := self.clientset.CoreV1().Services(self.config.GetSystemNamespace()).Create(ctx, tempSvc, metav1.CreateOptions{})
	if err != nil {
		return 0, fmt.Errorf("failed to create temporary service: %w", err)
	}

	// Get the allocated NodePort
	var nodePort int32
	if len(createdSvc.Spec.Ports) > 0 {
		nodePort = createdSvc.Spec.Ports[0].NodePort
	}

	// Delete the temporary service
	err = self.clientset.CoreV1().Services(self.config.GetSystemNamespace()).Delete(ctx, createdSvc.Name, metav1.DeleteOptions{})
	if err != nil {
		// Log the error but don't fail the function since we already got the port
		log.Warnf("failed to delete temporary service: %v", err)
	}

	if nodePort == 0 {
		return 0, fmt.Errorf("no NodePort was allocated for temporary service")
	}

	return nodePort, nil
}
