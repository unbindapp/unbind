package networking

import (
	"fmt"
	"maps"
	"strings"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
	discoveryv1 "k8s.io/api/discovery/v1"
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
// HTTPRoute/GRPCRoute for HTTP(S) hosts (certificate over HTTP-01, self-signed for
// wildcard hosts) and TCPRoute/UDPRoute for raw L4 ports (clean LB-IP:port endpoints,
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

	// HTTP / gRPC hosts: one HTTPS listener per hostname. Each HTTP host gets its own
	// HTTPRoute bound to its listener, since a rule cannot match on hostname and the
	// hosts differ in path, port, redirect, auth or headers. A hostname shared with
	// another service of the namespace listens on the Gateway of the one owning it.
	var listenedHosts, grpcHosts []v1.HostSpec
	var httpRouteNames []string
	if httpRoutable {
		listened := map[string]bool{}
		for _, host := range svc.Spec.Config.Hosts {
			if !p.canRoute(host) {
				continue
			}
			gateway := in.listenerGateway(host)
			if hostname := strings.ToLower(host.Host); gateway == svc.Name && !listened[hostname] {
				listened[hostname] = true
				listenedHosts = append(listenedHosts, host)
				listeners = append(listeners, gwapiv1.Listener{
					Name:     hostListenerName(host),
					Hostname: ptr.To(gwapiv1.Hostname(host.Host)),
					Port:     443,
					Protocol: gwapiv1.HTTPSProtocolType,
					TLS: &gwapiv1.ListenerTLSConfig{
						Mode:            ptr.To(gwapiv1.TLSModeTerminate),
						CertificateRefs: []gwapiv1.SecretObjectReference{{Name: gwapiv1.ObjectName(hostTLSSecretName(svc, host))}},
					},
					AllowedRoutes: &gwapiv1.AllowedRoutes{
						Namespaces: &gwapiv1.RouteNamespaces{From: ptr.To(gwapiv1.NamespacesFromSame)},
					},
				})
			}
			if host.Protocol == "grpc" {
				grpcHosts = append(grpcHosts, host)
				continue
			}
			name := hostObjectName(svc, host)
			httpRouteNames = append(httpRouteNames, name)
			objects = append(objects, p.httpRoute(svc, in.Labels, name, host, gateway))
			if target, ok := parseProxy(host.Proxy); ok {
				objects = append(objects, proxyUpstream(svc, in.Labels, host, target)...)
			}
			if p.cfg.GatewayControllerEnvoy && host.BasicAuth != nil {
				objects = append(objects,
					htpasswdSecret(svc, in.Labels, name, ".htpasswd", host.BasicAuth),
					envoyBasicAuthPolicy(svc, in.Labels, name),
				)
			}
		}
		if len(grpcHosts) > 0 {
			objects = append(objects, p.grpcRoute(svc, in.Labels, grpcHosts))
		}
		if p.cfg.GatewayControllerEnvoy && svc.Spec.Config.SessionAffinity && len(httpRouteNames) > 0 {
			objects = append(objects, envoyAffinityPolicy(in, httpRouteNames))
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

	// Emit an explicit Certificate (not the gateway-shim) with issue-temporary-certificate
	// so the HTTPS listener programs immediately; otherwise the shared Envoy resets that
	// SNI until ACME issues (ERR_CONNECTION_RESET). Raw L4 needs no cert.
	var acmeHosts []v1.HostSpec
	for _, host := range listenedHosts {
		if !isWildcardHost(host) {
			acmeHosts = append(acmeHosts, host)
		}
	}
	if len(acmeHosts) > 0 {
		objects = append(objects, p.certificate(svc, in.Labels, acmeHosts))
	}
	if wildcards := wildcardHosts(listenedHosts); len(wildcards) > 0 {
		objects = append(objects, wildcardCertificate(p.cfg, svc, in.Labels, wildcards))
	}

	if len(listeners) == 0 {
		return objects, nil
	}
	if p.cfg.GatewayControllerEnvoy && httpRoutable && svc.Spec.Config.ClientIPHeader != "" {
		objects = append(objects, envoyClientIPPolicy(in))
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
	// Last, so a listener never comes up before its route and auth policy exist
	return append(objects, gateway), nil
}

// ListenerGateways picks, for each hostname the service shares with other services of
// its namespace, the one whose Gateway carries the listener: the service routing the
// whole domain, else the oldest. Hostnames the service listens on itself are left out.
func ListenerGateways(cfg Config, svc *v1.Service, namespaceServices []v1.Service) map[string]string {
	p := gatewayProvider{cfg: cfg}
	owners := map[string]string{}
	for _, host := range p.routedHTTPHosts(svc) {
		hostname := strings.ToLower(host.Host)
		if _, ok := owners[hostname]; ok {
			continue
		}
		owner := svc
		for i := range namespaceServices {
			other := &namespaceServices[i]
			if other.Name != svc.Name && p.ownsListenerBefore(other, owner, hostname) {
				owner = other
			}
		}
		owners[hostname] = owner.Name
	}
	maps.DeleteFunc(owners, func(_, owner string) bool { return owner == svc.Name })
	return owners
}

func (p gatewayProvider) routedHTTPHosts(svc *v1.Service) []v1.HostSpec {
	if !svc.DeletionTimestamp.IsZero() || svc.Spec.Config.CronSchedule != "" || !needsRoutes(svc) {
		return nil
	}
	var hosts []v1.HostSpec
	for _, host := range svc.Spec.Config.Hosts {
		if host.Protocol != "grpc" && p.canRoute(host) {
			hosts = append(hosts, host)
		}
	}
	return hosts
}

func (p gatewayProvider) ownsListenerBefore(candidate, owner *v1.Service, hostname string) bool {
	candidateRoutes, candidateWhole := p.routesHostname(candidate, hostname)
	if !candidateRoutes {
		return false
	}
	_, ownerWhole := p.routesHostname(owner, hostname)
	if candidateWhole != ownerWhole {
		return candidateWhole
	}
	if !candidate.CreationTimestamp.Equal(&owner.CreationTimestamp) {
		return candidate.CreationTimestamp.Before(&owner.CreationTimestamp)
	}
	return candidate.Name < owner.Name
}

func (p gatewayProvider) routesHostname(svc *v1.Service, hostname string) (routes, wholeDomain bool) {
	for _, host := range p.routedHTTPHosts(svc) {
		if !strings.EqualFold(host.Host, hostname) {
			continue
		}
		routes = true
		wholeDomain = wholeDomain || hostPath(host) == "/"
	}
	return routes, wholeDomain
}

// Only Envoy Gateway reaches hostnames outside the cluster. A proxied host it cannot
// serve gets no route at all, never one to the service.
func (p gatewayProvider) canRoute(host v1.HostSpec) bool {
	if host.Proxy == nil {
		return true
	}
	_, ok := parseProxy(host.Proxy)
	return ok && p.cfg.GatewayControllerEnvoy
}

func hostListenerName(host v1.HostSpec) gwapiv1.SectionName {
	return gwapiv1.SectionName("https-" + hostnameKey(host))
}

func (p gatewayProvider) parentRef(gateway string, section *gwapiv1.SectionName) gwapiv1.ParentReference {
	return gwapiv1.ParentReference{
		Group:       ptr.To(gwapiv1.Group("gateway.networking.k8s.io")),
		Kind:        ptr.To(gwapiv1.Kind("Gateway")),
		Name:        gwapiv1.ObjectName(gateway),
		SectionName: section,
	}
}

func (p gatewayProvider) httpRoute(svc *v1.Service, labels map[string]string, name string, host v1.HostSpec, gateway string) *gwapiv1.HTTPRoute {
	port, path := resolveHostPort(svc, host)
	rule := gwapiv1.HTTPRouteRule{
		Matches: []gwapiv1.HTTPRouteMatch{{
			Path: &gwapiv1.HTTPPathMatch{Type: ptr.To(gwapiv1.PathMatchPathPrefix), Value: ptr.To(path)},
		}},
	}
	redirect, redirected := parseRedirect(host.Redirect)
	proxy, proxied := parseProxy(host.Proxy)
	switch {
	case redirected:
		rule.Filters = append(rule.Filters, redirectFilter(redirect, host.Redirect.StatusCode))
	case proxied:
		rule.Filters = append(rule.Filters, proxyRewriteFilter(proxy))
		rule.BackendRefs = httpBackendRefs(proxyUpstreamName(svc, host), proxy.PortOrDefault())
		rule.Timeouts = longRequestTimeouts()
	default:
		rule.BackendRefs = httpBackendRefs(svc.Name, port)
		rule.Timeouts = longRequestTimeouts()
	}
	if len(host.ResponseHeaders) > 0 {
		rule.Filters = append(rule.Filters, responseHeaderFilter(host.ResponseHeaders))
	}
	section := hostListenerName(host)
	return &gwapiv1.HTTPRoute{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: svc.Namespace, Labels: labels},
		Spec: gwapiv1.HTTPRouteSpec{
			CommonRouteSpec: gwapiv1.CommonRouteSpec{ParentRefs: []gwapiv1.ParentReference{p.parentRef(gateway, &section)}},
			Hostnames:       []gwapiv1.Hostname{gwapiv1.Hostname(host.Host)},
			Rules:           []gwapiv1.HTTPRouteRule{rule},
		},
	}
}

func httpBackendRefs(serviceName string, port int32) []gwapiv1.HTTPBackendRef {
	return []gwapiv1.HTTPBackendRef{{BackendRef: gwapiv1.BackendRef{
		BackendObjectReference: gwapiv1.BackendObjectReference{Name: gwapiv1.ObjectName(serviceName), Port: ptr.To(gwapiv1.PortNumber(port))},
	}}}
}

func longRequestTimeouts() *gwapiv1.HTTPRouteTimeouts {
	return &gwapiv1.HTTPRouteTimeouts{Request: ptr.To(gwapiv1.Duration("21600s"))}
}

func proxyRewriteFilter(target urlTarget) gwapiv1.HTTPRouteFilter {
	rewrite := &gwapiv1.HTTPURLRewriteFilter{Hostname: ptr.To(gwapiv1.PreciseHostname(target.Host))}
	if target.Path != "" {
		rewrite.Path = &gwapiv1.HTTPPathModifier{Type: gwapiv1.FullPathHTTPPathModifier, ReplaceFullPath: ptr.To(target.Path)}
	}
	return gwapiv1.HTTPRouteFilter{Type: gwapiv1.HTTPRouteFilterURLRewrite, URLRewrite: rewrite}
}

const proxyPortName = "upstream"

// proxyUpstream is the proxy target as a Service without a selector. Envoy Gateway
// refuses ExternalName Services, but resolves the hostname of an FQDN EndpointSlice.
func proxyUpstream(svc *v1.Service, labels map[string]string, host v1.HostSpec, target urlTarget) []client.Object {
	name := proxyUpstreamName(svc, host)
	port := target.PortOrDefault()
	upstreamLabels := maps.Clone(labels)
	// Endpoint discovery lists the Services carrying it as the service's own addresses
	delete(upstreamLabels, "unbind-service")

	service := &corev1.Service{
		TypeMeta:   metav1.TypeMeta{APIVersion: "v1", Kind: "Service"},
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: svc.Namespace, Labels: upstreamLabels},
		Spec: corev1.ServiceSpec{
			ClusterIP: corev1.ClusterIPNone,
			// Selector-less headless Services default to dual stack, and Envoy aborts on an IPv6 upstream without IPv6
			IPFamilyPolicy: ptr.To(corev1.IPFamilyPolicySingleStack),
			Ports:          []corev1.ServicePort{{Name: proxyPortName, Port: port, Protocol: corev1.ProtocolTCP}},
		},
	}

	sliceLabels := maps.Clone(upstreamLabels)
	sliceLabels[discoveryv1.LabelServiceName] = name
	sliceLabels[discoveryv1.LabelManagedBy] = "unbind-operator"
	slice := &discoveryv1.EndpointSlice{
		TypeMeta:    metav1.TypeMeta{APIVersion: "discovery.k8s.io/v1", Kind: "EndpointSlice"},
		ObjectMeta:  metav1.ObjectMeta{Name: name, Namespace: svc.Namespace, Labels: sliceLabels},
		AddressType: discoveryv1.AddressTypeFQDN,
		Endpoints:   []discoveryv1.Endpoint{{Addresses: []string{target.Host}}},
		Ports:       []discoveryv1.EndpointPort{{Name: ptr.To(proxyPortName), Port: ptr.To(port), Protocol: ptr.To(corev1.ProtocolTCP)}},
	}
	if target.Scheme != "https" {
		return []client.Object{service, slice}
	}

	policy := &gwapiv1.BackendTLSPolicy{
		TypeMeta:   metav1.TypeMeta{APIVersion: gwapiv1.GroupVersion.String(), Kind: "BackendTLSPolicy"},
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: svc.Namespace, Labels: upstreamLabels},
		Spec: gwapiv1.BackendTLSPolicySpec{
			TargetRefs: []gwapiv1.LocalPolicyTargetReferenceWithSectionName{{
				LocalPolicyTargetReference: gwapiv1.LocalPolicyTargetReference{Group: "", Kind: "Service", Name: gwapiv1.ObjectName(name)},
			}},
			Validation: gwapiv1.BackendTLSPolicyValidation{
				Hostname:                gwapiv1.PreciseHostname(target.Host),
				WellKnownCACertificates: ptr.To(gwapiv1.WellKnownCACertificatesSystem),
			},
		},
	}
	return []client.Object{service, slice, policy}
}

func redirectFilter(target urlTarget, statusCode int32) gwapiv1.HTTPRouteFilter {
	redirect := &gwapiv1.HTTPRequestRedirectFilter{
		Scheme:     ptr.To(target.Scheme),
		Hostname:   ptr.To(gwapiv1.PreciseHostname(target.Host)),
		StatusCode: ptr.To(int(statusCode)),
	}
	if target.Port != nil {
		redirect.Port = ptr.To(gwapiv1.PortNumber(*target.Port))
	}
	if target.Path != "" {
		redirect.Path = &gwapiv1.HTTPPathModifier{Type: gwapiv1.FullPathHTTPPathModifier, ReplaceFullPath: ptr.To(target.Path)}
	}
	return gwapiv1.HTTPRouteFilter{Type: gwapiv1.HTTPRouteFilterRequestRedirect, RequestRedirect: redirect}
}

func responseHeaderFilter(headers []v1.HostHeaderSpec) gwapiv1.HTTPRouteFilter {
	set := make([]gwapiv1.HTTPHeader, len(headers))
	for i, header := range headers {
		set[i] = gwapiv1.HTTPHeader{Name: gwapiv1.HTTPHeaderName(header.Name), Value: header.Value}
	}
	return gwapiv1.HTTPRouteFilter{
		Type:                   gwapiv1.HTTPRouteFilterResponseHeaderModifier,
		ResponseHeaderModifier: &gwapiv1.HTTPHeaderFilter{Set: set},
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
			CommonRouteSpec: gwapiv1.CommonRouteSpec{ParentRefs: []gwapiv1.ParentReference{p.parentRef(svc.Name, nil)}},
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
		Name: gwapiv1.ObjectName(l4BackendName(svc)), Port: ptr.To(gwapiv1.PortNumber(port.Port)),
	}}}
	parents := []gwapiv1.ParentReference{p.parentRef(svc.Name, &section)}

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

// certificate builds the cert-manager Certificate for a service's HTTPS listeners.
// issue-temporary-certificate seeds a self-signed cert so the listener programs
// before ACME completes.
func (p gatewayProvider) certificate(svc *v1.Service, labels map[string]string, hosts []v1.HostSpec) *unstructured.Unstructured {
	u := newCertificate(svc, labels, tlsSecretName(svc), p.cfg.ClusterIssuer, hosts)
	u.SetAnnotations(map[string]string{"cert-manager.io/issue-temporary-certificate": "true"})
	return u
}

func envoyPolicy(svc *v1.Service, labels map[string]string, kind, name string, spec map[string]any) *unstructured.Unstructured {
	u := &unstructured.Unstructured{}
	u.SetGroupVersionKind(schema.GroupVersionKind{Group: "gateway.envoyproxy.io", Version: "v1alpha1", Kind: kind})
	u.SetName(name)
	u.SetNamespace(svc.Namespace)
	u.SetLabels(labels)
	u.Object["spec"] = spec
	return u
}

func routeTargetRefs(names []string) []any {
	refs := make([]any, len(names))
	for i, name := range names {
		refs[i] = map[string]any{"group": "gateway.networking.k8s.io", "kind": "HTTPRoute", "name": name}
	}
	return refs
}

// envoyAffinityPolicy reproduces nginx cookie session affinity via an Envoy
// Gateway BackendTrafficPolicy, the only portable spot for it on Gateway API.
func envoyAffinityPolicy(in RouteInput, routeNames []string) *unstructured.Unstructured {
	svc := in.Service
	return envoyPolicy(svc, in.Labels, "BackendTrafficPolicy", svc.Name, map[string]any{
		"targetRefs": routeTargetRefs(routeNames),
		"loadBalancer": map[string]any{
			"type": "ConsistentHash",
			"consistentHash": map[string]any{
				"type":   "Cookie",
				"cookie": map[string]any{"name": fmt.Sprintf("%s-session", svc.Name), "ttl": "48h"},
			},
		},
	})
}

// envoyBasicAuthPolicy guards one host's HTTPRoute with the htpasswd Secret of the
// same name. Envoy Gateway reads the users from the .htpasswd key.
func envoyBasicAuthPolicy(svc *v1.Service, labels map[string]string, routeName string) *unstructured.Unstructured {
	return envoyPolicy(svc, labels, "SecurityPolicy", routeName, map[string]any{
		"targetRefs": routeTargetRefs([]string{routeName}),
		"basicAuth":  map[string]any{"users": map[string]any{"name": htpasswdSecretName(routeName)}},
	})
}

// envoyClientIPPolicy makes Envoy take the visitor's address from the header a
// proxy in front of the service sets, for every listener of the service's Gateway.
// Requests without the header keep the address of the connection.
func envoyClientIPPolicy(in RouteInput) *unstructured.Unstructured {
	svc := in.Service
	return envoyPolicy(svc, in.Labels, "ClientTrafficPolicy", svc.Name, map[string]any{
		"targetRefs": []any{map[string]any{"group": "gateway.networking.k8s.io", "kind": "Gateway", "name": svc.Name}},
		"clientIPDetection": map[string]any{
			"customHeader": map[string]any{"name": svc.Spec.Config.ClientIPHeader, "failClosed": false},
		},
	})
}
