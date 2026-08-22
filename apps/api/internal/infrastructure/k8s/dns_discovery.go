package k8s

import (
	"context"
	"crypto/x509"
	"encoding/pem"
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

	var attempting []attemptingHost

	// Process ingresses (external endpoints)
	for _, ing := range ingresses.Items {
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
				status, err := self.hostStatus(ctx, namespace, host, tls.SecretName, checkDNS, client)
				if err != nil {
					return nil, err
				}
				discovery.External = append(discovery.External, externalEndpoint(ing.Name, ing.Labels, host, backend.Path, backend.Port, status))
				if status.TLS == models.TlsStatusAttempting && tls.SecretName != "" {
					attempting = append(attempting, attemptingHost{Host: host, SecretName: tls.SecretName})
				}
			}
		}
	}

	// Gateway clusters route via HTTPRoutes rather than Ingresses
	if self.NetworkingProvider(ctx) == providerGateway {
		gateways, err := self.listGateways(ctx, namespace, labelSelector)
		if err != nil {
			return nil, err
		}
		gatewayAttempting, err := self.appendGatewayEndpoints(ctx, namespace, labelSelector, gatewayTLSSecrets(gateways), checkDNS, client, discovery)
		if err != nil {
			return nil, err
		}
		attempting = append(attempting, gatewayAttempting...)
		self.appendGatewayL4Endpoints(ctx, gateways, discovery)
	}

	// If there are any hosts in "Attempting" state, fetch their CertificateRequest conditions
	if len(attempting) > 0 && self.certmanagerclient != nil {
		// List all CertificateRequests
		allCrList, err := self.certmanagerclient.CertmanagerV1().CertificateRequests(namespace).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, host := range attempting {
				var relevantCrs []certmanagerv1.CertificateRequest
				for _, cr := range allCrList.Items {
					if ann, ok := cr.Annotations["cert-manager.io/certificate-name"]; ok && ann == host.SecretName {
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
						// Attach to the endpoint
						for i := range discovery.External {
							if discovery.External[i].Host == host.Host && discovery.External[i].TlsStatus == models.TlsStatusAttempting {
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

type attemptingHost struct {
	Host       string
	SecretName string
}

type hostStatus struct {
	DNS                          models.DNSStatus
	TLS                          models.TlsStatus
	Cloudflare                   bool
	CloudflareMissingCertificate bool
}

// hostStatus resolves DNS and TLS state for one external host; an issued certificate
// covering the host implies DNS resolved, otherwise the host is probed directly.
func (self *KubeClient) hostStatus(ctx context.Context, namespace, host, secretName string, checkDNS bool, client kubernetes.Interface) (hostStatus, error) {
	status := hostStatus{DNS: models.DNSStatusUnknown, TLS: models.TlsStatusAttempting}

	if secretName != "" {
		secret, err := client.CoreV1().Secrets(namespace).Get(ctx, secretName, metav1.GetOptions{})
		if err == nil && certificateCoversHost(secret, host) {
			status.DNS = models.DNSStatusResolved
			status.TLS = models.TlsStatusIssued
		}
	}

	if !checkDNS {
		return status, nil
	}

	if status.DNS == models.DNSStatusResolved {
		status.Cloudflare, _ = self.dnsChecker.IsUsingCloudflareProxy(host)
		status.CloudflareMissingCertificate = status.Cloudflare && !self.dnsChecker.ServesTLS(host)
		return status, nil
	}

	ips, err := self.GetIngressNginxIP(ctx)
	if err != nil {
		return status, fmt.Errorf("failed to get ingress nginx IP: %w", err)
	}
	configured, _ := self.dnsChecker.IsPointingToIP(host, ips.IPv4)
	if !configured {
		configured, _ = self.dnsChecker.IsPointingToIP(host, ips.IPv6)
	}
	if !configured {
		status.Cloudflare, _ = self.dnsChecker.IsUsingCloudflareProxy(host)
		if status.Cloudflare {
			status.CloudflareMissingCertificate = !self.dnsChecker.ServesTLS(host)
			configured = !status.CloudflareMissingCertificate && self.reachableThroughCloudflare(ctx, host)
		}
	}

	status.DNS = models.DNSStatusUnresolved
	if configured {
		status.DNS = models.DNSStatusResolved
	}
	return status, nil
}

func (self *KubeClient) reachableThroughCloudflare(ctx context.Context, host string) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("https://%s", host), nil)
	if err != nil {
		log.Warnf("Error creating HTTP request for domain %s: %v", host, err)
		return false
	}
	resp, err := self.httpClient.Do(req)
	if err != nil {
		log.Warnf("Error executing HTTP request for domain %s: %v", host, err)
		return false
	}
	resp.Body.Close()
	return true
}

func externalEndpoint(name string, labels map[string]string, host, path string, port int32, status hostStatus) models.IngressEndpoint {
	teamID, _ := uuid.Parse(labels["unbind-team"])
	projectID, _ := uuid.Parse(labels["unbind-project"])
	environmentID, _ := uuid.Parse(labels["unbind-environment"])
	serviceID, _ := uuid.Parse(labels["unbind-service"])

	return models.IngressEndpoint{
		KubernetesName: name,
		IsIngress:      true,
		Host:           host,
		Path:           path,
		TargetPort: &schema.PortSpec{
			Port:     port,
			Protocol: utils.ToPtr(schema.ProtocolTCP),
		},
		DNSStatus:                    status.DNS,
		IsCloudflare:                 status.Cloudflare,
		CloudflareMissingCertificate: status.CloudflareMissingCertificate,
		TlsStatus:                    status.TLS,
		TeamID:                       teamID,
		ProjectID:                    projectID,
		EnvironmentID:                environmentID,
		ServiceID:                    serviceID,
	}
}

func (self *KubeClient) listGateways(ctx context.Context, namespace, labelSelector string) ([]unstructured.Unstructured, error) {
	if self.client == nil {
		return nil, nil
	}
	gateways, err := self.client.Resource(gatewayGVR).Namespace(namespace).List(ctx, metav1.ListOptions{LabelSelector: labelSelector})
	if err != nil {
		if meta.IsNoMatchError(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to list gateways with labels %s: %w", labelSelector, err)
	}
	return gateways.Items, nil
}

// gatewayTLSSecrets maps each HTTPS listener hostname to the TLS secret it terminates with.
func gatewayTLSSecrets(gateways []unstructured.Unstructured) map[string]string {
	secrets := map[string]string{}
	for i := range gateways {
		listeners, _, _ := unstructured.NestedSlice(gateways[i].Object, "spec", "listeners")
		for _, l := range listeners {
			listener, ok := l.(map[string]any)
			if !ok {
				continue
			}
			proto, _, _ := unstructured.NestedString(listener, "protocol")
			if proto != "HTTPS" {
				continue
			}
			hostname, _, _ := unstructured.NestedString(listener, "hostname")
			refs, _, _ := unstructured.NestedSlice(listener, "tls", "certificateRefs")
			if hostname == "" || len(refs) == 0 {
				continue
			}
			ref, ok := refs[0].(map[string]any)
			if !ok {
				continue
			}
			secretName, _, _ := unstructured.NestedString(ref, "name")
			secrets[hostname] = secretName
		}
	}
	return secrets
}

// appendGatewayEndpoints lists HTTPRoutes matching the labels and appends them as
// external endpoints, resolving each hostname's status through the TLS secret of
// the Gateway listener that terminates it.
func (self *KubeClient) appendGatewayEndpoints(ctx context.Context, namespace, labelSelector string, tlsSecrets map[string]string, checkDNS bool, client kubernetes.Interface, discovery *models.EndpointDiscovery) ([]attemptingHost, error) {
	if self.client == nil {
		return nil, nil
	}
	routes, err := self.client.Resource(httpRouteGVR).Namespace(namespace).List(ctx, metav1.ListOptions{LabelSelector: labelSelector})
	if err != nil {
		if meta.IsNoMatchError(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to list httproutes with labels %s: %w", labelSelector, err)
	}

	var attempting []attemptingHost
	for i := range routes.Items {
		route := &routes.Items[i]
		hostnames, _, _ := unstructured.NestedStringSlice(route.Object, "spec", "hostnames")
		rules, _, _ := unstructured.NestedSlice(route.Object, "spec", "rules")
		path, port := gatewayRoutePathPort(rules)

		for _, host := range hostnames {
			secretName := tlsSecrets[host]
			status, err := self.hostStatus(ctx, namespace, host, secretName, checkDNS, client)
			if err != nil {
				return nil, err
			}
			discovery.External = append(discovery.External, externalEndpoint(route.GetName(), route.GetLabels(), host, path, port, status))
			if status.TLS == models.TlsStatusAttempting && secretName != "" {
				attempting = append(attempting, attemptingHost{Host: host, SecretName: secretName})
			}
		}
	}
	return attempting, nil
}

// appendGatewayL4Endpoints reports raw TCP/UDP exposure from per-service Gateways'
// L4 listeners as LB-IP:port endpoints (the gateway equivalent of NodePort).
func (self *KubeClient) appendGatewayL4Endpoints(ctx context.Context, gateways []unstructured.Unstructured, discovery *models.EndpointDiscovery) {
	if len(gateways) == 0 {
		return
	}

	lb, err := self.GetActiveControllerIP(ctx)
	host := ""
	if err == nil {
		host = lb.IPv4
		if host == "" {
			host = lb.IPv6
		}
	}

	for i := range gateways {
		gw := &gateways[i]
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

// cert-manager signs issue-temporary-certificate placeholders with a throwaway CA
// named cert-manager.local (cert-manager pkg/util/pki/temporarycertificate.go).
const temporaryCertificateIssuer = "cert-manager.local"

// certificateCoversHost reports whether the secret holds an issued (non-temporary)
// certificate valid for host.
func certificateCoversHost(secret *corev1.Secret, host string) bool {
	if secret == nil {
		return false
	}
	block, _ := pem.Decode(secret.Data[corev1.TLSCertKey])
	if block == nil {
		return false
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return false
	}
	if cert.Issuer.CommonName == temporaryCertificateIssuer {
		return false
	}
	return cert.VerifyHostname(host) == nil
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
// even behind a Cloudflare proxy. Returns the route name and the URL to probe.
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

	provider := self.NetworkingProvider(ctx)
	scheme := "https"
	switch provider {
	case providerGateway:
		// The platform gateway only accepts foreign hostnames on its :80 listener; on :443 the
		// host's SNI is owned by the service's own Gateway, whose listeners allow same-namespace
		// routes only (operator networking/gateway.go), so the probe must go over plain HTTP, the
		// same path the ACME HTTP-01 solver takes.
		scheme = "http"
		err = self.createVerificationHTTPRoute(ctx, name, domain, path)
	default:
		err = self.createVerificationIngress(ctx, name, domain, path, provider, client)
	}
	if err != nil {
		return "", "", err
	}
	return name, fmt.Sprintf("%s://%s%s", scheme, domain, path), nil
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
