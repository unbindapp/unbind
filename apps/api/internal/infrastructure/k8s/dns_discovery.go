package k8s

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	certmanagerv1 "github.com/cert-manager/cert-manager/pkg/apis/certmanager/v1"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// DiscoverEndpointsByLabels returns both internal (services) and external (ingresses) endpoints
// matching the provided labels in a namespace
func (self *KubeClient) DiscoverEndpointsByLabels(ctx context.Context, namespace string, labels map[string]string, checkDNS bool, client kubernetes.Interface) (*models.EndpointDiscovery, error) {
	// Convert the labels map to a selector string
	var labelSelectors []string
	for key, value := range labels {
		labelSelectors = append(labelSelectors, fmt.Sprintf("%s=%s", key, value))
	}
	labelSelector := strings.Join(labelSelectors, ",")

	discovery := &models.EndpointDiscovery{
		Internal: []models.ServiceEndpoint{},
		External: []models.IngressEndpoint{},
	}

	// Get services matching the label selector
	services, err := client.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list services with labels %s: %w", labelSelector, err)
	}

	// Process services (internal endpoints)
	for _, svc := range services.Items {
		teamID, _ := uuid.Parse(svc.Labels["unbind-team"])
		projectID, _ := uuid.Parse(svc.Labels["unbind-project"])
		environmentID, _ := uuid.Parse(svc.Labels["unbind-environment"])
		serviceID, _ := uuid.Parse(svc.Labels["unbind-service"])

		// Only process ClusterIP services as internal
		if svc.Spec.Type == corev1.ServiceTypeClusterIP {
			endpoint := models.ServiceEndpoint{
				KubernetesName: svc.Name,
				DNS:            fmt.Sprintf("%s.%s", svc.Name, namespace),
				Ports:          make([]schema.PortSpec, len(svc.Spec.Ports)),
				TeamID:         teamID,
				ProjectID:      projectID,
				EnvironmentID:  environmentID,
				ServiceID:      serviceID,
			}

			// Add port information
			for i, port := range svc.Spec.Ports {
				endpoint.Ports[i] = schema.PortSpec{
					Port:     port.Port,
					Protocol: utils.ToPtr(schema.Protocol(port.Protocol)),
				}
			}

			discovery.Internal = append(discovery.Internal, endpoint)
		} else if svc.Spec.Type == corev1.ServiceTypeNodePort || svc.Spec.Type == corev1.ServiceTypeLoadBalancer {
			// Process NodePort and LoadBalancer services as external
			// Get the node IPs, use internal client for this
			nodes, err := self.GetInternalClient().CoreV1().Nodes().List(ctx, metav1.ListOptions{})
			if err != nil {
				return nil, fmt.Errorf("failed to list nodes: %w", err)
			}

			// Sort nodes by created_at desc
			sort.Slice(nodes.Items, func(i, j int) bool {
				return nodes.Items[i].CreationTimestamp.After(nodes.Items[j].CreationTimestamp.Time)
			})

			var nodeIPs []string
			ipCount := 0
			maxNodes := 5 // Limit to 5 node IPs to return
			for _, node := range nodes.Items {
				for _, addr := range node.Status.Addresses {
					if addr.Type == corev1.NodeExternalIP {
						nodeIPs = append(nodeIPs, addr.Address)
						ipCount++
						break
					}
				}
				if ipCount >= maxNodes {
					break
				}
			}

			// Add each port as a host with the node IPs
			for _, port := range svc.Spec.Ports {
				if port.NodePort > 0 {
					for _, nodeIP := range nodeIPs {
						endpoint := models.IngressEndpoint{
							KubernetesName: svc.Name,
							IsIngress:      false,
							Host:           nodeIP,
							Path:           "/",
							DNSStatus:      models.DNSStatusUnknown,
							TargetPort: &schema.PortSpec{
								IsNodePort: true,
								Port:       port.NodePort,
								NodePort:   utils.ToPtr(port.NodePort),
								Protocol:   utils.ToPtr(schema.Protocol(port.Protocol)),
							},
							TlsStatus:     models.TlsStatusNotAvailable,
							TeamID:        teamID,
							ProjectID:     projectID,
							EnvironmentID: environmentID,
							ServiceID:     serviceID,
						}
						discovery.External = append(discovery.External, endpoint)
					}
				}
			}

			// Add LoadBalancer external IPs if available
			if svc.Spec.Type == corev1.ServiceTypeLoadBalancer {
				for _, ingress := range svc.Status.LoadBalancer.Ingress {
					if ingress.IP != "" {
						for _, port := range svc.Spec.Ports {
							// Also add the external IP with the NodePort if it exists
							if port.NodePort > 0 {
								host := fmt.Sprintf("%s:%d", ingress.IP, port.NodePort)
								endpoint := models.IngressEndpoint{
									KubernetesName: svc.Name,
									IsIngress:      false,
									Host:           host,
									Path:           "/",
									TargetPort: &schema.PortSpec{
										IsNodePort: true,
										Port:       port.NodePort,
										NodePort:   utils.ToPtr(port.NodePort),
										Protocol:   utils.ToPtr(schema.Protocol(port.Protocol)),
									},
									DNSStatus:     models.DNSStatusUnknown,
									TlsStatus:     models.TlsStatusNotAvailable,
									TeamID:        teamID,
									ProjectID:     projectID,
									EnvironmentID: environmentID,
									ServiceID:     serviceID,
								}
								discovery.External = append(discovery.External, endpoint)
							}
						}
					}
				}
			}
		}
	}

	// Get ingresses matching the label selector
	ingresses, err := client.NetworkingV1().Ingresses(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list ingresses with labels %s: %w", labelSelector, err)
	}

	// Temp store for ingresses that need CR check
	type attemptingIngressDetails struct {
		Host       string
		SecretName string
	}
	var ingressesToCheck []attemptingIngressDetails

	// Process ingresses (external endpoints)
	for _, ing := range ingresses.Items {
		teamID, _ := uuid.Parse(ing.Labels["unbind-team"])
		projectID, _ := uuid.Parse(ing.Labels["unbind-project"])
		environmentID, _ := uuid.Parse(ing.Labels["unbind-environment"])
		serviceID, _ := uuid.Parse(ing.Labels["unbind-service"])

		// Make a map of paths and backend ports to iterate TLS
		type backendInfo struct {
			Path string
			Port int32
		}
		backendMap := make(map[string]backendInfo)

		for _, rule := range ing.Spec.Rules {
			host := rule.Host

			if rule.HTTP != nil {
				for _, path := range rule.HTTP.Paths {
					var port int32 = 443 // Default fallback port

					// Extract the actual backend service port
					if path.Backend.Service != nil {
						if path.Backend.Service.Port.Number != 0 {
							port = path.Backend.Service.Port.Number
						}
					}

					backendMap[host] = backendInfo{
						Path: path.Path,
						Port: port,
					}
				}
			}
		}

		// Only consider TLS for ingresses, get path and port from map above
		for _, tls := range ing.Spec.TLS {
			for _, host := range tls.Hosts {
				backend := backendMap[host]
				path := backend.Path
				port := backend.Port

				// Check if the secret is issued
				issued := false
				tlsStatus := models.TlsStatusAttempting

				dnsStatus := models.DNSStatusUnknown
				if tls.SecretName != "" {
					secret, err := client.CoreV1().Secrets(namespace).Get(ctx, tls.SecretName, metav1.GetOptions{})
					issued = err == nil && isCertificateIssued(secret)
				}
				if issued {
					dnsStatus = models.DNSStatusResolved
					tlsStatus = models.TlsStatusIssued
				}

				isCloudflare := false
				if checkDNS && dnsStatus == models.DNSStatusUnknown {
					ips, err := self.GetIngressNginxIP(ctx)
					if err != nil {
						return nil, fmt.Errorf("failed to get ingress nginx IP: %w", err)
					}
					// Check ipv4 first
					dnsConfigured, _ := self.dnsChecker.IsPointingToIP(host, ips.IPv4)
					if !dnsConfigured {
						// Check ipv6
						dnsConfigured, _ = self.dnsChecker.IsPointingToIP(host, ips.IPv6)
					}
					if !dnsConfigured {
						// Check cloudflare
						isCloudflare, _ = self.dnsChecker.IsUsingCloudflareProxy(host)

						if isCloudflare {
							url := fmt.Sprintf("https://%s", host)

							// Create a new request with context
							req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
							if err != nil {
								log.Warnf("Error creating HTTP request for domain %s: %v", host, err)
							} else {
								// Execute the request once to check DNS resolution
								resp, err := self.httpClient.Do(req)
								if err != nil {
									log.Warnf("Error executing HTTP request for domain %s: %v", host, err)
									// If request fails, DNS is not resolved
									dnsConfigured = false
								} else {
									func() {
										defer resp.Body.Close()
										dnsConfigured = true
									}()
								}
							}
						}
					}
					dnsStatus = models.DNSStatusUnresolved
					if dnsConfigured {
						dnsStatus = models.DNSStatusResolved
					}
				} else if checkDNS {
					isCloudflare, _ = self.dnsChecker.IsUsingCloudflareProxy(host)
				}

				endpoint := models.IngressEndpoint{
					KubernetesName: ing.Name,
					IsIngress:      true,
					Host:           host,
					Path:           path,
					TargetPort: &schema.PortSpec{
						Port:     port,
						Protocol: utils.ToPtr(schema.ProtocolTCP),
					},
					DNSStatus:     dnsStatus,
					IsCloudflare:  isCloudflare,
					TlsStatus:     tlsStatus,
					TeamID:        teamID,
					ProjectID:     projectID,
					EnvironmentID: environmentID,
					ServiceID:     serviceID,
				}
				discovery.External = append(discovery.External, endpoint)

				// For attempting ones dig into cert-manager to get the status
				if tlsStatus == models.TlsStatusAttempting && tls.SecretName != "" {
					ingressesToCheck = append(ingressesToCheck, attemptingIngressDetails{
						Host:       host,
						SecretName: tls.SecretName,
					})
				}
			}
		}
	}

	// If there are any ingresses in "Attempting" state, fetch their CertificateRequest conditions
	if len(ingressesToCheck) > 0 && self.certmanagerclient != nil {
		// List all CertificateRequests
		allCrList, err := self.certmanagerclient.CertmanagerV1().CertificateRequests(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, ingress := range ingressesToCheck {
				var relevantCrs []certmanagerv1.CertificateRequest
				for _, cr := range allCrList.Items {
					if ann, ok := cr.Annotations["cert-manager.io/certificate-name"]; ok && ann == ingress.SecretName {
						relevantCrs = append(relevantCrs, cr)
					}
				}

				if len(relevantCrs) > 0 {
					// Sort CRs by CreationTimestamp in descending order (newest first)
					sort.Slice(relevantCrs, func(i, j int) bool {
						return relevantCrs[j].CreationTimestamp.Before(&relevantCrs[i].CreationTimestamp)
					})

					cr := relevantCrs[0] // Take the newest CR

					var messages []models.TlsDetails
					for _, cond := range cr.Status.Conditions {
						messages = append(messages, models.TlsDetails{
							Condition: models.CertManagerConditionType(cond.Type),
							Reason:    cond.Reason,
							Message:   cond.Message,
						})
					}
					if len(messages) > 0 {
						// Attach to the ingress
						for i := range discovery.External {
							if discovery.External[i].Host == ingress.Host && discovery.External[i].TlsStatus == models.TlsStatusAttempting {
								discovery.External[i].TlsIssuerMessages = messages
							}
						}
					}
				}
			}
		} else {
			log.Warn("Failed to list CertificateRequests", "error", err)
		}
	}

	return discovery, nil
}

// isCertificateIssued checks if a TLS secret contains valid certificate data
func isCertificateIssued(secret *corev1.Secret) bool {
	if secret == nil {
		return false
	}

	// Check if the secret contains the required TLS data
	_, hasCert := secret.Data["tls.crt"]
	_, hasKey := secret.Data["tls.key"]

	// Check if the secret has any cert-manager annotations
	hasCertManagerAnnotation := false
	if secret.Annotations != nil {
		for key := range secret.Annotations {
			if strings.Contains(key, "cert-manager") {
				hasCertManagerAnnotation = true
				break
			}
		}
	}

	// Both fields must exist and contain data, and it should have cert-manager annotations
	return hasCert && hasKey && len(secret.Data["tls.crt"]) > 0 && len(secret.Data["tls.key"]) > 0 && hasCertManagerAnnotation
}

// CreateVerificationIngress creates an ingress with a configuration snippet to help verify
// that a domain is pointing to the Kubernetes cluster
func (self *KubeClient) CreateVerificationIngress(
	ctx context.Context,
	domain string,
	client kubernetes.Interface,
) (*networkingv1.Ingress, string, error) {
	pathType := networkingv1.PathTypeImplementationSpecific
	ingressClassName := "nginx"

	name, err := utils.GenerateSlug(domain)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate slug for domain %s: %w", domain, err)
	}

	path := fmt.Sprintf("/.unbind-challenge/dns-check/%s", uuid.NewString())

	// Create the ingress specification
	ingress := &networkingv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: self.config.GetSystemNamespace(),
			Annotations: map[string]string{
				"nginx.ingress.kubernetes.io/ssl-redirect": "false",
				"nginx.ingress.kubernetes.io/configuration-snippet": `
add_header X-DNS-Check "resolved" always;
return 200 "Domain verification successful: CloudFlare connection to Kubernetes confirmed";
add_header Content-Type text/plain;
`,
			},
			Labels: map[string]string{
				"app":       "unbind-verification",
				"type":      "domain-verification",
				"domain":    domain,
				"temporary": "true",
			},
		},
		Spec: networkingv1.IngressSpec{
			IngressClassName: &ingressClassName,
			Rules: []networkingv1.IngressRule{
				{
					Host: domain,
					IngressRuleValue: networkingv1.IngressRuleValue{
						HTTP: &networkingv1.HTTPIngressRuleValue{
							Paths: []networkingv1.HTTPIngressPath{
								{
									Path:     path,
									PathType: &pathType,
									Backend: networkingv1.IngressBackend{
										Service: &networkingv1.IngressServiceBackend{
											Name: "dummy-service",
											Port: networkingv1.ServiceBackendPort{
												Number: 80,
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	// Create the ingress in the cluster
	ing, err := client.NetworkingV1().Ingresses(self.config.GetSystemNamespace()).Create(ctx, ingress, metav1.CreateOptions{})
	return ing, path, err
}

// DeleteVerificationIngress deletes the verification ingress for a domain
func (self *KubeClient) DeleteVerificationIngress(
	ctx context.Context,
	ingressName string,
	client kubernetes.Interface,
) error {
	// Delete the ingress
	err := client.NetworkingV1().Ingresses(self.config.GetSystemNamespace()).Delete(ctx, ingressName, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete verification ingress %s: %w", ingressName, err)
	}

	return nil
}

// DeleteOldVerificationIngresses deletes verification ingresses created more than 10 minutes ago
func (self *KubeClient) DeleteOldVerificationIngresses(
	ctx context.Context,
	client kubernetes.Interface,
) error {
	// Create a label selector for the verification ingresses
	labelSelector := "app=unbind-verification,type=domain-verification,temporary=true"

	// Get the list of ingresses matching the label selector
	ingresses, err := client.NetworkingV1().Ingresses(self.config.GetSystemNamespace()).List(
		ctx,
		metav1.ListOptions{
			LabelSelector: labelSelector,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to list verification ingresses: %w", err)
	}

	// Get the current time to compare against creation time
	currentTime := time.Now()
	cutoffTime := currentTime.Add(-10 * time.Minute)

	// Delete each matching ingress that is older than 10 minutes
	for _, ingress := range ingresses.Items {
		creationTime := ingress.GetCreationTimestamp().Time

		// Skip ingresses that are less than 10 minutes old
		if creationTime.After(cutoffTime) {
			continue
		}

		err := client.NetworkingV1().Ingresses(self.config.GetSystemNamespace()).Delete(
			ctx,
			ingress.Name,
			metav1.DeleteOptions{},
		)
		if err != nil {
			return fmt.Errorf("failed to delete old verification ingress %s: %w", ingress.Name, err)
		}
	}

	return nil
}
