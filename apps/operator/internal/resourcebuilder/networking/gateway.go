package networking

import (
	"fmt"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/utils/ptr"
	"sigs.k8s.io/controller-runtime/pkg/client"
	gwapiv1 "sigs.k8s.io/gateway-api/apis/v1"
	gwapiv1a2 "sigs.k8s.io/gateway-api/apis/v1alpha2"
)

type gatewayProvider struct {
	cfg Config
}

func (gatewayProvider) Name() Provider { return ProviderGateway }

func (gatewayProvider) ServiceAnnotations(*v1.Service) map[string]string { return nil }

func (gatewayProvider) ExposesL4ViaGateway() bool { return true }

// BuildRoutes emits a per-service Gateway plus the routes for each exposure:
// HTTPRoute/GRPCRoute for HTTP(S) hosts (per-host cert via the gateway-shim over
// HTTP-01) and TCPRoute/UDPRoute for raw L4 ports (clean LB-IP:port endpoints,
// replacing NodePort). mergeGateways lands them all on one Envoy fleet / LB IP.
func (p gatewayProvider) BuildRoutes(in RouteInput) ([]client.Object, error) {
	svc := in.Service
	httpRoutable := needsRoutes(svc)
	l4Ports := externalL4Ports(svc)
	if !httpRoutable && len(l4Ports) == 0 {
		return nil, ErrRouteNotNeeded
	}

	var listeners []gwapiv1.Listener
	var objects []client.Object

	// HTTP / gRPC hosts: one HTTPS listener per host, split into HTTPRoute/GRPCRoute.
	var httpHosts, grpcHosts []v1.HostSpec
	if httpRoutable {
		for i, host := range svc.Spec.Config.Hosts {
			listeners = append(listeners, gwapiv1.Listener{
				Name:     gwapiv1.SectionName(fmt.Sprintf("https-%d", i)),
				Hostname: ptr.To(gwapiv1.Hostname(host.Host)),
				Port:     443,
				Protocol: gwapiv1.HTTPSProtocolType,
				TLS: &gwapiv1.ListenerTLSConfig{
					Mode:            ptr.To(gwapiv1.TLSModeTerminate),
					CertificateRefs: []gwapiv1.SecretObjectReference{{Name: gwapiv1.ObjectName(tlsSecretName(svc))}},
				},
				AllowedRoutes: &gwapiv1.AllowedRoutes{
					Namespaces: &gwapiv1.RouteNamespaces{From: ptr.To(gwapiv1.NamespacesFromSame)},
				},
			})
			if host.Protocol == "grpc" {
				grpcHosts = append(grpcHosts, host)
			} else {
				httpHosts = append(httpHosts, host)
			}
		}
		if len(httpHosts) > 0 {
			objects = append(objects, p.httpRoute(svc, in.Labels, httpHosts))
		}
		if len(grpcHosts) > 0 {
			objects = append(objects, p.grpcRoute(svc, in.Labels, grpcHosts))
		}
		if p.cfg.GatewayControllerEnvoy {
			objects = append(objects, envoyAffinityPolicy(in))
		}
	}

	// Raw L4 ports: one TCP/UDP listener + matching route per port.
	for _, port := range l4Ports {
		listenerName := gwapiv1.SectionName(fmt.Sprintf("l4-%d", *port.NodePort))
		proto := portProtocol(port)
		listenerProto := gwapiv1.TCPProtocolType
		routeKind := gwapiv1.Kind("TCPRoute")
		if proto == "UDP" {
			listenerProto = gwapiv1.UDPProtocolType
			routeKind = gwapiv1.Kind("UDPRoute")
		}
		listeners = append(listeners, gwapiv1.Listener{
			Name:     listenerName,
			Port:     gwapiv1.PortNumber(*port.NodePort),
			Protocol: listenerProto,
			AllowedRoutes: &gwapiv1.AllowedRoutes{
				Kinds:      []gwapiv1.RouteGroupKind{{Group: ptr.To(gwapiv1.Group("gateway.networking.k8s.io")), Kind: routeKind}},
				Namespaces: &gwapiv1.RouteNamespaces{From: ptr.To(gwapiv1.NamespacesFromSame)},
			},
		})
		objects = append(objects, p.l4Route(svc, in.Labels, port, listenerName, proto))
	}

	gateway := &gwapiv1.Gateway{
		ObjectMeta: metav1.ObjectMeta{
			Name:      svc.Name,
			Namespace: svc.Namespace,
			Labels:    in.Labels,
		},
		Spec: gwapiv1.GatewaySpec{
			GatewayClassName: gwapiv1.ObjectName(p.cfg.GatewayClassName),
			Listeners:        listeners,
		},
	}
	// HTTPS listeners need a cert; raw L4 does not. We emit an explicit cert-manager
	// Certificate rather than relying on the gateway-shim (which the
	// cert-manager.io/cluster-issuer annotation would trigger) so we can set
	// issue-temporary-certificate: cert-manager writes a self-signed placeholder into
	// the secret immediately, so the HTTPS listener programs right away and the host
	// is reachable even before — or during an outage of — ACME. With mergeGateways one
	// Envoy serves every host on :443, so a host whose listener never programmed makes
	// Envoy reset the connection for that SNI (ERR_CONNECTION_RESET); the placeholder
	// avoids that. cert-manager swaps in the real cert once issuance succeeds.
	certHosts := append([]v1.HostSpec{}, httpHosts...)
	certHosts = append(certHosts, grpcHosts...)
	if len(certHosts) > 0 {
		objects = append(objects, p.certificate(svc, in.Labels, certHosts))
	}

	return append([]client.Object{gateway}, objects...), nil
}

func (p gatewayProvider) parentRef(svc *v1.Service, section *gwapiv1.SectionName) gwapiv1.ParentReference {
	return gwapiv1.ParentReference{
		Group:       ptr.To(gwapiv1.Group("gateway.networking.k8s.io")),
		Kind:        ptr.To(gwapiv1.Kind("Gateway")),
		Name:        gwapiv1.ObjectName(svc.Name),
		SectionName: section,
	}
}

func (p gatewayProvider) httpRoute(svc *v1.Service, labels map[string]string, hosts []v1.HostSpec) *gwapiv1.HTTPRoute {
	hostnames := make([]gwapiv1.Hostname, len(hosts))
	rules := make([]gwapiv1.HTTPRouteRule, len(hosts))
	for i, host := range hosts {
		port, path := resolveHostPort(svc, host)
		hostnames[i] = gwapiv1.Hostname(host.Host)
		rules[i] = gwapiv1.HTTPRouteRule{
			Matches: []gwapiv1.HTTPRouteMatch{{
				Path: &gwapiv1.HTTPPathMatch{Type: ptr.To(gwapiv1.PathMatchPathPrefix), Value: ptr.To(path)},
			}},
			BackendRefs: []gwapiv1.HTTPBackendRef{{BackendRef: gwapiv1.BackendRef{
				BackendObjectReference: gwapiv1.BackendObjectReference{Name: gwapiv1.ObjectName(svc.Name), Port: ptr.To(gwapiv1.PortNumber(port))},
			}}},
			Timeouts: &gwapiv1.HTTPRouteTimeouts{Request: ptr.To(gwapiv1.Duration("21600s"))},
		}
	}
	return &gwapiv1.HTTPRoute{
		ObjectMeta: metav1.ObjectMeta{Name: svc.Name, Namespace: svc.Namespace, Labels: labels},
		Spec: gwapiv1.HTTPRouteSpec{
			CommonRouteSpec: gwapiv1.CommonRouteSpec{ParentRefs: []gwapiv1.ParentReference{p.parentRef(svc, nil)}},
			Hostnames:       hostnames,
			Rules:           rules,
		},
	}
}

func (p gatewayProvider) grpcRoute(svc *v1.Service, labels map[string]string, hosts []v1.HostSpec) *gwapiv1.GRPCRoute {
	hostnames := make([]gwapiv1.Hostname, len(hosts))
	port := svc.Spec.Config.Ports[0].Port
	for i, host := range hosts {
		hostnames[i] = gwapiv1.Hostname(host.Host)
		if host.Port != nil {
			port = *host.Port
		}
	}
	return &gwapiv1.GRPCRoute{
		ObjectMeta: metav1.ObjectMeta{Name: svc.Name + "-grpc", Namespace: svc.Namespace, Labels: labels},
		Spec: gwapiv1.GRPCRouteSpec{
			CommonRouteSpec: gwapiv1.CommonRouteSpec{ParentRefs: []gwapiv1.ParentReference{p.parentRef(svc, nil)}},
			Hostnames:       hostnames,
			Rules: []gwapiv1.GRPCRouteRule{{
				BackendRefs: []gwapiv1.GRPCBackendRef{{BackendRef: gwapiv1.BackendRef{
					BackendObjectReference: gwapiv1.BackendObjectReference{Name: gwapiv1.ObjectName(svc.Name), Port: ptr.To(gwapiv1.PortNumber(port))},
				}}},
			}},
		},
	}
}

func (p gatewayProvider) l4Route(svc *v1.Service, labels map[string]string, port v1.PortSpec, section gwapiv1.SectionName, proto string) client.Object {
	name := fmt.Sprintf("%s-%s-%d", svc.Name, "tcp", *port.NodePort)
	backend := []gwapiv1a2.BackendRef{{BackendObjectReference: gwapiv1.BackendObjectReference{
		Name: gwapiv1.ObjectName(svc.Name), Port: ptr.To(gwapiv1.PortNumber(port.Port)),
	}}}
	parents := []gwapiv1.ParentReference{p.parentRef(svc, &section)}

	if proto == "UDP" {
		name = fmt.Sprintf("%s-udp-%d", svc.Name, *port.NodePort)
		return &gwapiv1a2.UDPRoute{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: svc.Namespace, Labels: labels},
			Spec: gwapiv1a2.UDPRouteSpec{
				CommonRouteSpec: gwapiv1.CommonRouteSpec{ParentRefs: parents},
				Rules:           []gwapiv1a2.UDPRouteRule{{BackendRefs: backend}},
			},
		}
	}
	return &gwapiv1a2.TCPRoute{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: svc.Namespace, Labels: labels},
		Spec: gwapiv1a2.TCPRouteSpec{
			CommonRouteSpec: gwapiv1.CommonRouteSpec{ParentRefs: parents},
			Rules:           []gwapiv1a2.TCPRouteRule{{BackendRefs: backend}},
		},
	}
}

// certificate builds the cert-manager Certificate backing a service's HTTPS
// listeners. The issue-temporary-certificate annotation makes cert-manager write a
// self-signed placeholder into the secret immediately so the listener programs
// before ACME completes; it is overwritten with the real cert once issued. Built
// unstructured to avoid a hard dependency on the cert-manager API module.
func (p gatewayProvider) certificate(svc *v1.Service, labels map[string]string, hosts []v1.HostSpec) *unstructured.Unstructured {
	dnsNames := make([]any, len(hosts))
	for i, h := range hosts {
		dnsNames[i] = h.Host
	}
	u := &unstructured.Unstructured{}
	u.SetGroupVersionKind(schema.GroupVersionKind{Group: "cert-manager.io", Version: "v1", Kind: "Certificate"})
	u.SetName(tlsSecretName(svc))
	u.SetNamespace(svc.Namespace)
	u.SetLabels(labels)
	u.SetAnnotations(map[string]string{"cert-manager.io/issue-temporary-certificate": "true"})
	u.Object["spec"] = map[string]any{
		"secretName": tlsSecretName(svc),
		"dnsNames":   dnsNames,
		"issuerRef": map[string]any{
			"name":  p.cfg.ClusterIssuer,
			"kind":  "ClusterIssuer",
			"group": "cert-manager.io",
		},
	}
	return u
}

// envoyAffinityPolicy reproduces nginx cookie session affinity via an Envoy
// Gateway BackendTrafficPolicy, the only portable spot for it on Gateway API.
func envoyAffinityPolicy(in RouteInput) *unstructured.Unstructured {
	svc := in.Service
	u := &unstructured.Unstructured{}
	u.SetGroupVersionKind(schema.GroupVersionKind{Group: "gateway.envoyproxy.io", Version: "v1alpha1", Kind: "BackendTrafficPolicy"})
	u.SetName(svc.Name)
	u.SetNamespace(svc.Namespace)
	u.SetLabels(in.Labels)
	u.Object["spec"] = map[string]any{
		"targetRefs": []any{map[string]any{
			"group": "gateway.networking.k8s.io",
			"kind":  "HTTPRoute",
			"name":  svc.Name,
		}},
		"loadBalancer": map[string]any{
			"type": "ConsistentHash",
			"consistentHash": map[string]any{
				"type":   "Cookie",
				"cookie": map[string]any{"name": fmt.Sprintf("%s-session", svc.Name), "ttl": "172800s"},
			},
		},
	}
	return u
}
