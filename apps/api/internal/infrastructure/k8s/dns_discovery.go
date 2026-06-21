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
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
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
					Protocol: new(schema.Protocol(port.Protocol)),
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
								NodePort:   new(port.NodePort),
								Protocol:   new(schema.Protocol(port.Protocol)),
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
										NodePort:   new(port.NodePort),
										Protocol:   new(schema.Protocol(port.Protocol)),
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

	// Gateway clusters route via HTTPRoutes rather than Ingresses
	if self.NetworkingProvider(ctx) == providerGateway {
		if err := self.appendGatewayEndpoints(ctx, namespace, labelSelector, discovery); err != nil {
			return nil, err
		}
		if err := self.appendGatewayL4Endpoints(ctx, namespace, labelSelector, discovery); err != nil {
			return nil, err
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

// appendGatewayEndpoints lists HTTPRoutes matching the labels and appends them as
// external endpoints. TLS is terminated at the shared gateway, so routes that exist
// are treated as TLS-issued.
func (self *KubeClient) appendGatewayEndpoints(ctx context.Context, namespace, labelSelector string, discovery *models.EndpointDiscovery) error {
	if self.client == nil {
		return nil
	}
	routes, err := self.client.Resource(httpRouteGVR).Namespace(namespace).List(ctx, metav1.ListOptions{LabelSelector: labelSelector})
	if err != nil {
		if meta.IsNoMatchError(err) {
			return nil
		}
		return fmt.Errorf("failed to list httproutes with labels %s: %w", labelSelector, err)
	}

	for i := range routes.Items {
		route := &routes.Items[i]
		labels := route.GetLabels()
		teamID, _ := uuid.Parse(labels["unbind-team"])
		projectID, _ := uuid.Parse(labels["unbind-project"])
		environmentID, _ := uuid.Parse(labels["unbind-environment"])
		serviceID, _ := uuid.Parse(labels["unbind-service"])

		hostnames, _, _ := unstructured.NestedStringSlice(route.Object, "spec", "hostnames")
		rules, _, _ := unstructured.NestedSlice(route.Object, "spec", "rules")
		path, port := gatewayRoutePathPort(rules)

		for _, host := range hostnames {
			discovery.External = append(discovery.External, models.IngressEndpoint{
				KubernetesName: route.GetName(),
				IsIngress:      true,
				Host:           host,
				Path:           path,
				TargetPort: &schema.PortSpec{
					Port:     port,
					Protocol: utils.ToPtr(schema.ProtocolTCP),
				},
				DNSStatus:     models.DNSStatusUnknown,
				TlsStatus:     models.TlsStatusIssued,
				TeamID:        teamID,
				ProjectID:     projectID,
				EnvironmentID: environmentID,
				ServiceID:     serviceID,
			})
		}
	}
	return nil
}

// appendGatewayL4Endpoints reports raw TCP/UDP exposure from per-service Gateways'
// L4 listeners as LB-IP:port endpoints (the gateway equivalent of NodePort).
func (self *KubeClient) appendGatewayL4Endpoints(ctx context.Context, namespace, labelSelector string, discovery *models.EndpointDiscovery) error {
	if self.client == nil {
		return nil
	}
	gateways, err := self.client.Resource(gatewayGVR).Namespace(namespace).List(ctx, metav1.ListOptions{LabelSelector: labelSelector})
	if err != nil {
		if meta.IsNoMatchError(err) {
			return nil
		}
		return fmt.Errorf("failed to list gateways with labels %s: %w", labelSelector, err)
	}
	if len(gateways.Items) == 0 {
		return nil
	}

	lb, err := self.GetActiveControllerIP(ctx)
	host := ""
	if err == nil {
		host = lb.IPv4
		if host == "" {
			host = lb.IPv6
		}
	}

	for i := range gateways.Items {
		gw := &gateways.Items[i]
		labels := gw.GetLabels()
		teamID, _ := uuid.Parse(labels["unbind-team"])
		projectID, _ := uuid.Parse(labels["unbind-project"])
		environmentID, _ := uuid.Parse(labels["unbind-environment"])
		serviceID, _ := uuid.Parse(labels["unbind-service"])

		listeners, _, _ := unstructured.NestedSlice(gw.Object, "spec", "listeners")
		for _, l := range listeners {
			listener, ok := l.(map[string]any)
			if !ok {
				continue
			}
			proto, _, _ := unstructured.NestedString(listener, "protocol")
			if proto != "TCP" && proto != "UDP" {
				continue
			}
			portNum, _, _ := unstructured.NestedInt64(listener, "port")
			discovery.External = append(discovery.External, models.IngressEndpoint{
				KubernetesName: gw.GetName(),
				IsIngress:      false,
				Host:           host,
				Path:           "",
				TargetPort: &schema.PortSpec{
					Port:     int32(portNum),
					Protocol: new(schema.Protocol(proto)),
				},
				DNSStatus:     models.DNSStatusUnknown,
				TlsStatus:     models.TlsStatusNotAvailable,
				TeamID:        teamID,
				ProjectID:     projectID,
				EnvironmentID: environmentID,
				ServiceID:     serviceID,
			})
		}
	}
	return nil
}

func gatewayRoutePathPort(rules []any) (string, int32) {
	path := "/"
	var port int32 = 443
	if len(rules) == 0 {
		return path, port
	}
	rule, ok := rules[0].(map[string]any)
	if !ok {
		return path, port
	}
	if matches, ok := rule["matches"].([]any); ok && len(matches) > 0 {
		if match, ok := matches[0].(map[string]any); ok {
			if p, ok := match["path"].(map[string]any); ok {
				if v, ok := p["value"].(string); ok && v != "" {
					path = v
				}
			}
		}
	}
	if backends, ok := rule["backendRefs"].([]any); ok && len(backends) > 0 {
		if backend, ok := backends[0].(map[string]any); ok {
			if v, ok := backend["port"].(int64); ok {
				port = int32(v)
			}
		}
	}
	return path, port
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

const (
	challengeResponderService = "unbind-challenge-responder"
	verificationPathPrefix    = "/.unbind-challenge/"
	verificationLabelSelector = "app=unbind-verification,type=domain-verification,temporary=true"
)

func verificationLabels(domain string) map[string]string {
	return map[string]string{
		"app":       "unbind-verification",
		"type":      "domain-verification",
		"domain":    domain,
		"temporary": "true",
	}
}

// CreateVerificationRoute creates a temporary route (Ingress or HTTPRoute, per the
// active networking provider) that points a challenge path at the shared
// challenge-responder service, used to verify a domain resolves to the cluster
// even behind a Cloudflare proxy. Returns the route name and challenge path.
func (self *KubeClient) CreateVerificationRoute(
	ctx context.Context,
	domain string,
	client kubernetes.Interface,
) (string, string, error) {
	name, err := utils.GenerateSlug(domain)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate slug for domain %s: %w", domain, err)
	}
	path := verificationPathPrefix + uuid.NewString()

	switch self.NetworkingProvider(ctx) {
	case providerGateway:
		err = self.createVerificationHTTPRoute(ctx, name, domain, path)
	default:
		err = self.createVerificationIngress(ctx, name, domain, path, self.NetworkingProvider(ctx), client)
	}
	if err != nil {
		return "", "", err
	}
	return name, path, nil
}

func (self *KubeClient) createVerificationIngress(ctx context.Context, name, domain, path, className string, client kubernetes.Interface) error {
	pathType := networkingv1.PathTypePrefix
	ingress := &networkingv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{
			Name:        name,
			Namespace:   self.config.GetSystemNamespace(),
			Labels:      verificationLabels(domain),
			Annotations: map[string]string{"kubernetes.io/tls-acme": "false"},
		},
		Spec: networkingv1.IngressSpec{
			IngressClassName: &className,
			Rules: []networkingv1.IngressRule{{
				Host: domain,
				IngressRuleValue: networkingv1.IngressRuleValue{
					HTTP: &networkingv1.HTTPIngressRuleValue{
						Paths: []networkingv1.HTTPIngressPath{{
							Path:     path,
							PathType: &pathType,
							Backend: networkingv1.IngressBackend{
								Service: &networkingv1.IngressServiceBackend{
									Name: challengeResponderService,
									Port: networkingv1.ServiceBackendPort{Number: 80},
								},
							},
						}},
					},
				},
			}},
		},
	}
	_, err := client.NetworkingV1().Ingresses(self.config.GetSystemNamespace()).Create(ctx, ingress, metav1.CreateOptions{})
	return err
}

func (self *KubeClient) createVerificationHTTPRoute(ctx context.Context, name, domain, path string) error {
	route := &unstructured.Unstructured{}
	route.SetAPIVersion("gateway.networking.k8s.io/v1")
	route.SetKind("HTTPRoute")
	route.SetName(name)
	route.SetNamespace(self.config.GetSystemNamespace())
	route.SetLabels(verificationLabels(domain))
	route.Object["spec"] = map[string]any{
		"parentRefs": []any{map[string]any{
			"group":     "gateway.networking.k8s.io",
			"kind":      "Gateway",
			"name":      self.config.GetGatewayName(),
			"namespace": self.config.GetGatewayNamespace(),
		}},
		"hostnames": []any{domain},
		"rules": []any{map[string]any{
			"matches": []any{map[string]any{
				"path": map[string]any{"type": "PathPrefix", "value": path},
			}},
			"backendRefs": []any{map[string]any{
				"name": challengeResponderService,
				"port": int64(80),
			}},
		}},
	}
	_, err := self.client.Resource(httpRouteGVR).Namespace(self.config.GetSystemNamespace()).Create(ctx, route, metav1.CreateOptions{})
	return err
}

// DeleteVerificationRoute removes a verification route by name, covering both the
// Ingress and HTTPRoute kinds and treating a missing object as success.
func (self *KubeClient) DeleteVerificationRoute(
	ctx context.Context,
	name string,
	client kubernetes.Interface,
) error {
	namespace := self.config.GetSystemNamespace()
	if err := client.NetworkingV1().Ingresses(namespace).Delete(ctx, name, metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to delete verification ingress %s: %w", name, err)
	}
	if self.client != nil {
		err := self.client.Resource(httpRouteGVR).Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{})
		if err != nil && !apierrors.IsNotFound(err) && !meta.IsNoMatchError(err) {
			return fmt.Errorf("failed to delete verification httproute %s: %w", name, err)
		}
	}
	return nil
}

// DeleteOldVerificationRoutes deletes verification routes (Ingress + HTTPRoute)
// created more than 10 minutes ago.
func (self *KubeClient) DeleteOldVerificationRoutes(
	ctx context.Context,
	client kubernetes.Interface,
) error {
	namespace := self.config.GetSystemNamespace()
	cutoff := time.Now().Add(-10 * time.Minute)

	ingresses, err := client.NetworkingV1().Ingresses(namespace).List(ctx, metav1.ListOptions{LabelSelector: verificationLabelSelector})
	if err != nil {
		return fmt.Errorf("failed to list verification ingresses: %w", err)
	}
	for _, ingress := range ingresses.Items {
		if ingress.GetCreationTimestamp().After(cutoff) {
			continue
		}
		if err := client.NetworkingV1().Ingresses(namespace).Delete(ctx, ingress.Name, metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
			return fmt.Errorf("failed to delete old verification ingress %s: %w", ingress.Name, err)
		}
	}

	if self.client == nil {
		return nil
	}
	routes, err := self.client.Resource(httpRouteGVR).Namespace(namespace).List(ctx, metav1.ListOptions{LabelSelector: verificationLabelSelector})
	if err != nil {
		if meta.IsNoMatchError(err) {
			return nil
		}
		return fmt.Errorf("failed to list verification httproutes: %w", err)
	}
	for _, route := range routes.Items {
		if route.GetCreationTimestamp().After(cutoff) {
			continue
		}
		if err := self.client.Resource(httpRouteGVR).Namespace(namespace).Delete(ctx, route.GetName(), metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
			return fmt.Errorf("failed to delete old verification httproute %s: %w", route.GetName(), err)
		}
	}
	return nil
}
