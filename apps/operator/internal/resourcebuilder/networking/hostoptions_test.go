package networking

import (
	"encoding/base64"
	"fmt"
	"reflect"
	"slices"
	"strings"
	"testing"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
	discoveryv1 "k8s.io/api/discovery/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/utils/ptr"
	"sigs.k8s.io/controller-runtime/pkg/client"
	gwapiv1 "sigs.k8s.io/gateway-api/apis/v1"
)

var envoyConfig = Config{GatewayClassName: "unbind", ClusterIssuer: "le", GatewayControllerEnvoy: true}

func httpRoutesByName(objs []client.Object) map[string]*gwapiv1.HTTPRoute {
	routes := map[string]*gwapiv1.HTTPRoute{}
	for _, o := range objs {
		if r, ok := o.(*gwapiv1.HTTPRoute); ok {
			routes[r.Name] = r
		}
	}
	return routes
}

func httpRouteFor(objs []client.Object, host string) *gwapiv1.HTTPRoute {
	for _, o := range objs {
		if r, ok := o.(*gwapiv1.HTTPRoute); ok && slices.Contains(r.Spec.Hostnames, gwapiv1.Hostname(host)) {
			return r
		}
	}
	return nil
}

func ingressFor(objs []client.Object, host string) *networkingv1.Ingress {
	for _, o := range objs {
		if i, ok := o.(*networkingv1.Ingress); ok && slices.Contains(ingressHostsOf(i), host) {
			return i
		}
	}
	return nil
}

func ingressesByName(objs []client.Object) map[string]*networkingv1.Ingress {
	ingresses := map[string]*networkingv1.Ingress{}
	for _, o := range objs {
		if i, ok := o.(*networkingv1.Ingress); ok {
			ingresses[i.Name] = i
		}
	}
	return ingresses
}

func findNamed(objs []client.Object, kind, name string) *unstructured.Unstructured {
	for _, o := range objs {
		if u, ok := o.(*unstructured.Unstructured); ok && u.GetKind() == kind && u.GetName() == name {
			return u
		}
	}
	return nil
}

// Each host binds its own listener, so a second host with another port reaches that port
func TestGatewayRoutePerHost(t *testing.T) {
	svc := setName(publicService(), "web")
	svc.Spec.Config.Ports = append(svc.Spec.Config.Ports, v1.PortSpec{Port: 9090})
	svc.Spec.Config.Hosts = append(svc.Spec.Config.Hosts, v1.HostSpec{Host: "admin.example.com", Path: "/", Port: ptr.To[int32](9090)})
	svc.Spec.Config.SessionAffinity = true

	objs, err := New(ProviderGateway, envoyConfig).BuildRoutes(RouteInput{Service: svc})
	if err != nil {
		t.Fatalf("BuildRoutes: %v", err)
	}
	routes := httpRoutesByName(objs)
	if len(routes) != 2 {
		t.Fatalf("expected a route per host, got %v", routes)
	}
	first, second := httpRouteFor(objs, "example.com"), httpRouteFor(objs, "admin.example.com")
	if first == nil || second == nil {
		t.Fatalf("expected a route per host, got %v", routes)
	}
	section := *second.Spec.ParentRefs[0].SectionName
	listener := slices.IndexFunc(findGateway(objs).Spec.Listeners, func(l gwapiv1.Listener) bool { return l.Name == section })
	if listener < 0 || string(*findGateway(objs).Spec.Listeners[listener].Hostname) != "admin.example.com" {
		t.Errorf("second route binds listener %q, which is not the admin.example.com listener", section)
	}
	if got := *second.Spec.Rules[0].BackendRefs[0].Port; got != 9090 {
		t.Errorf("second route port = %d, want 9090", got)
	}
	if got := *first.Spec.Rules[0].BackendRefs[0].Port; got != 8080 {
		t.Errorf("first route port = %d, want 8080", got)
	}

	policy := findKind(objs, "BackendTrafficPolicy")
	refs, _, _ := unstructured.NestedSlice(policy.Object, "spec", "targetRefs")
	if len(refs) != 2 {
		t.Errorf("affinity policy should target both routes, got %v", refs)
	}
}

func TestGatewayRedirect(t *testing.T) {
	svc := setName(publicService(), "web")
	svc.Spec.Config.Hosts = []v1.HostSpec{
		{Host: "www.example.com", Path: "/", Redirect: &v1.HostRedirectSpec{To: "https://example.com", StatusCode: 308}},
		{Host: "old.example.com", Path: "/", Redirect: &v1.HostRedirectSpec{To: "http://example.com:8080/new", StatusCode: 301}},
	}
	objs, err := New(ProviderGateway, envoyConfig).BuildRoutes(RouteInput{Service: svc})
	if err != nil {
		t.Fatalf("BuildRoutes: %v", err)
	}
	rule := httpRouteFor(objs, "www.example.com").Spec.Rules[0]
	if len(rule.BackendRefs) != 0 {
		t.Errorf("a redirect must not route to the service, got backends %v", rule.BackendRefs)
	}
	redirect := rule.Filters[0].RequestRedirect
	if *redirect.Scheme != "https" || string(*redirect.Hostname) != "example.com" || *redirect.StatusCode != 308 {
		t.Errorf("redirect = %+v", redirect)
	}
	if redirect.Path != nil || redirect.Port != nil {
		t.Errorf("a target without a path keeps the request path, got path %+v port %v", redirect.Path, redirect.Port)
	}

	redirect = httpRouteFor(objs, "old.example.com").Spec.Rules[0].Filters[0].RequestRedirect
	if *redirect.Scheme != "http" || *redirect.Port != 8080 || *redirect.StatusCode != 301 {
		t.Errorf("redirect = %+v", redirect)
	}
	if redirect.Path == nil || *redirect.Path.ReplaceFullPath != "/new" {
		t.Errorf("a target with a path replaces the request path, got %+v", redirect.Path)
	}
}

func TestGatewayBasicAuth(t *testing.T) {
	svc := setName(publicService(), "web")
	svc.Spec.Config.Hosts[0].BasicAuth = &v1.HostBasicAuthSpec{Username: "admin", PasswordHash: "{SHA}hash"}
	in := RouteInput{Service: svc}

	objs, err := New(ProviderGateway, envoyConfig).BuildRoutes(in)
	if err != nil {
		t.Fatalf("BuildRoutes: %v", err)
	}
	route := httpRouteFor(objs, "example.com").Name
	secret := findNamed(objs, "Secret", route+"-htpasswd")
	if secret == nil {
		t.Fatalf("expected the htpasswd secret, got %v", objs)
	}
	data, _, _ := unstructured.NestedString(secret.Object, "data", ".htpasswd")
	if data != base64.StdEncoding.EncodeToString([]byte("admin:{SHA}hash\n")) {
		t.Errorf("htpasswd data = %q", data)
	}
	policy := findNamed(objs, "SecurityPolicy", route)
	if policy == nil {
		t.Fatalf("expected a SecurityPolicy, got %v", objs)
	}
	if got, _, _ := unstructured.NestedString(policy.Object, "spec", "basicAuth", "users", "name"); got != route+"-htpasswd" {
		t.Errorf("policy users secret = %q", got)
	}
	refs, _, _ := unstructured.NestedSlice(policy.Object, "spec", "targetRefs")
	if name := refs[0].(map[string]any)["name"]; name != route {
		t.Errorf("policy target = %v, want the host's route", refs)
	}

	// A missing hash closes the host instead of opening it
	svc.Spec.Config.Hosts[0].BasicAuth.PasswordHash = ""
	objs, _ = New(ProviderGateway, envoyConfig).BuildRoutes(RouteInput{Service: svc})
	data, _, _ = unstructured.NestedString(findNamed(objs, "Secret", route+"-htpasswd").Object, "data", ".htpasswd")
	if data != "" {
		t.Errorf("missing hash should give an empty htpasswd, got %q", data)
	}
	svc.Spec.Config.Hosts[0].BasicAuth.PasswordHash = "{SHA}hash"

	// Only Envoy Gateway has a basic auth policy
	objs, _ = New(ProviderGateway, Config{GatewayClassName: "unbind", ClusterIssuer: "le"}).BuildRoutes(in)
	if findKind(objs, "SecurityPolicy") != nil || findKind(objs, "Secret") != nil {
		t.Errorf("non-envoy gateway should emit no basic auth objects")
	}
}

func TestGatewayResponseHeaders(t *testing.T) {
	svc := setName(publicService(), "web")
	svc.Spec.Config.Hosts[0].ResponseHeaders = []v1.HostHeaderSpec{
		{Name: "Strict-Transport-Security", Value: "max-age=31536000; includeSubDomains"},
		{Name: "Cache-Control", Value: "public, max-age=600"},
	}
	objs, _ := New(ProviderGateway, envoyConfig).BuildRoutes(RouteInput{Service: svc})
	rule := httpRouteFor(objs, "example.com").Spec.Rules[0]
	if len(rule.BackendRefs) != 1 {
		t.Errorf("headers keep the host routed, got backends %v", rule.BackendRefs)
	}
	set := rule.Filters[0].ResponseHeaderModifier.Set
	if len(set) != 2 || string(set[0].Name) != "Strict-Transport-Security" || set[1].Value != "public, max-age=600" {
		t.Errorf("response headers = %+v", set)
	}
}

func TestGatewayClientIPHeader(t *testing.T) {
	svc := setName(publicService(), "web")
	svc.Spec.Config.ClientIPHeader = "CF-Connecting-IP"
	objs, _ := New(ProviderGateway, envoyConfig).BuildRoutes(RouteInput{Service: svc})
	policy := findKind(objs, "ClientTrafficPolicy")
	if policy == nil {
		t.Fatalf("expected a ClientTrafficPolicy, got %v", objs)
	}
	if got, _, _ := unstructured.NestedString(policy.Object, "spec", "clientIPDetection", "customHeader", "name"); got != "CF-Connecting-IP" {
		t.Errorf("client ip header = %q", got)
	}
	refs, _, _ := unstructured.NestedSlice(policy.Object, "spec", "targetRefs")
	if ref := refs[0].(map[string]any); ref["kind"] != "Gateway" || ref["name"] != "web" {
		t.Errorf("policy should target the service gateway, got %v", refs)
	}

	svc.Spec.Config.ClientIPHeader = ""
	objs, _ = New(ProviderGateway, envoyConfig).BuildRoutes(RouteInput{Service: svc})
	if findKind(objs, "ClientTrafficPolicy") != nil {
		t.Errorf("no header, no policy")
	}
}

func TestNginxHostOptions(t *testing.T) {
	svc := setName(publicService(), "web")
	svc.Spec.Config.Hosts = append(svc.Spec.Config.Hosts, v1.HostSpec{
		Host: "www.example.com", Path: "/",
		Redirect:        &v1.HostRedirectSpec{To: "https://example.com", StatusCode: 308},
		BasicAuth:       &v1.HostBasicAuthSpec{Username: "u", PasswordHash: "h"},
		ResponseHeaders: []v1.HostHeaderSpec{{Name: "Cache-Control", Value: "public, max-age=600"}},
	})
	in := RouteInput{Service: svc}
	objs, err := New(ProviderNginx, Config{}).BuildRoutes(in)
	if err != nil {
		t.Fatalf("BuildRoutes: %v", err)
	}
	ingresses := ingressesByName(objs)
	if len(ingresses) != 2 {
		t.Fatalf("expected the shared ingress and one for the host with options, got %v", ingresses)
	}
	if hosts := ingressHostsOf(ingresses["web"]); len(hosts) != 1 || hosts[0] != "example.com" {
		t.Errorf("shared ingress hosts = %v", hosts)
	}
	host := ingressFor(objs, "www.example.com")
	if host == nil || host.Name == "web" {
		t.Fatalf("expected an ingress of its own for www.example.com, got %v", ingresses)
	}
	if got := host.Spec.TLS[0].SecretName; got != host.Name+"-tls-secret" {
		t.Errorf("host ingress tls secret = %q", got)
	}
	snippet := host.Annotations["nginx.ingress.kubernetes.io/configuration-snippet"]
	for _, want := range []string{`more_set_headers "Cache-Control: public, max-age=600";`, "return 308 https://example.com$request_uri;"} {
		if !strings.Contains(snippet, want) {
			t.Errorf("snippet %q lacks %q", snippet, want)
		}
	}
	if host.Annotations["nginx.ingress.kubernetes.io/auth-type"] != "basic" || host.Annotations["nginx.ingress.kubernetes.io/auth-secret"] != host.Name+"-htpasswd" {
		t.Errorf("auth annotations = %v", host.Annotations)
	}
	secret := findNamed(objs, "Secret", host.Name+"-htpasswd")
	if data, _, _ := unstructured.NestedString(secret.Object, "data", "auth"); data != base64.StdEncoding.EncodeToString([]byte("u:h\n")) {
		t.Errorf("nginx reads the auth key, got %q", data)
	}

	// A redirect to a path drops the request path
	svc.Spec.Config.Hosts[1].Redirect.To = "https://example.com/plugins"
	objs, _ = New(ProviderNginx, Config{}).BuildRoutes(in)
	snippet = ingressFor(objs, "www.example.com").Annotations["nginx.ingress.kubernetes.io/configuration-snippet"]
	if !strings.Contains(snippet, "return 308 https://example.com/plugins;") {
		t.Errorf("snippet = %q", snippet)
	}
}

func ingressHostsOf(ingress *networkingv1.Ingress) []string {
	var hosts []string
	for _, rule := range ingress.Spec.Rules {
		hosts = append(hosts, rule.Host)
	}
	return hosts
}

func TestTraefikHostOptions(t *testing.T) {
	svc := setName(publicService(), "web")
	svc.Spec.Config.Hosts = []v1.HostSpec{{
		Host: "www.example.com", Path: "/",
		Redirect:        &v1.HostRedirectSpec{To: "https://example.com", StatusCode: 302},
		BasicAuth:       &v1.HostBasicAuthSpec{Username: "u"},
		ResponseHeaders: []v1.HostHeaderSpec{{Name: "Cache-Control", Value: "no-store"}},
	}}
	svc.Namespace = "ns"
	objs, err := New(ProviderTraefik, Config{}).BuildRoutes(RouteInput{Service: svc})
	if err != nil {
		t.Fatalf("BuildRoutes: %v", err)
	}
	ingresses := ingressesByName(objs)
	if _, shared := ingresses["web"]; shared || len(ingresses) != 1 {
		t.Fatalf("every host has options, so only its own ingress is expected, got %v", ingresses)
	}
	name := ingressFor(objs, "www.example.com").Name
	want := fmt.Sprintf("ns-web-redirect@kubernetescrd,ns-web-buffering@kubernetescrd,ns-%[1]s-redirect@kubernetescrd,ns-%[1]s-auth@kubernetescrd,ns-%[1]s-headers@kubernetescrd", name)
	if got := ingresses[name].Annotations["traefik.ingress.kubernetes.io/router.middlewares"]; got != want {
		t.Errorf("middlewares = %q, want %q", got, want)
	}

	redirect := findNamed(objs, "Middleware", name+"-redirect")
	if regex, _, _ := unstructured.NestedString(redirect.Object, "spec", "redirectRegex", "regex"); regex != "^https?://[^/]+(.*)$" {
		t.Errorf("redirect regex = %q", regex)
	}
	if replacement, _, _ := unstructured.NestedString(redirect.Object, "spec", "redirectRegex", "replacement"); replacement != "https://example.com${1}" {
		t.Errorf("redirect replacement = %q", replacement)
	}
	if permanent, _, _ := unstructured.NestedBool(redirect.Object, "spec", "redirectRegex", "permanent"); permanent {
		t.Errorf("302 is not permanent")
	}
	auth := findNamed(objs, "Middleware", name+"-auth")
	if secret, _, _ := unstructured.NestedString(auth.Object, "spec", "basicAuth", "secret"); secret != name+"-htpasswd" {
		t.Errorf("auth secret = %q", secret)
	}
	if data, _, _ := unstructured.NestedString(findNamed(objs, "Secret", name+"-htpasswd").Object, "data", "users"); data != "" {
		t.Errorf("traefik reads the users key, and a missing hash leaves it empty, got %q", data)
	}
	headers := findNamed(objs, "Middleware", name+"-headers")
	if value, _, _ := unstructured.NestedString(headers.Object, "spec", "headers", "customResponseHeaders", "Cache-Control"); value != "no-store" {
		t.Errorf("header value = %q", value)
	}
}

// Removing or inserting a host must leave every other host's objects as they were
func TestRemovingHostKeepsOtherHosts(t *testing.T) {
	hosts := []v1.HostSpec{
		{Host: "danklinux.com", Path: "/"},
		{Host: "plugins.danklinux.com", Path: "/", Redirect: &v1.HostRedirectSpec{To: "https://danklinux.com/plugins", StatusCode: 308}},
		{Host: "install.danklinux.com", Path: "/", ResponseHeaders: []v1.HostHeaderSpec{{Name: "Cache-Control", Value: "no-store"}}},
		{Host: "api.danklinux.com", Path: "/", BasicAuth: &v1.HostBasicAuthSpec{Username: "u", PasswordHash: "h"}},
	}
	for _, provider := range []Provider{ProviderGateway, ProviderNginx, ProviderTraefik} {
		withPlugins := buildWithHosts(t, provider, hosts)
		withoutPlugins := buildWithHosts(t, provider, slices.Concat(hosts[:1], hosts[2:]))
		assertKept(t, provider, withoutPlugins, withPlugins)
	}
}

func buildWithHosts(t *testing.T, provider Provider, hosts []v1.HostSpec) []client.Object {
	t.Helper()
	svc := setName(publicService(), "dux")
	svc.Spec.Config.Hosts = hosts
	objs, err := New(provider, envoyConfig).BuildRoutes(RouteInput{Service: svc})
	if err != nil {
		t.Fatalf("%s BuildRoutes: %v", provider, err)
	}
	return objs
}

func objectKey(obj client.Object) string {
	if u, ok := obj.(*unstructured.Unstructured); ok {
		return u.GetKind() + "/" + u.GetName()
	}
	return fmt.Sprintf("%T/%s", obj, obj.GetName())
}

// assertKept checks every object of fewer is in more unchanged, apart from the
// Gateway's listener list and the Certificate, which name every host.
func assertKept(t *testing.T, provider Provider, fewer, more []client.Object) {
	t.Helper()
	moreByKey := map[string]client.Object{}
	for _, obj := range more {
		moreByKey[objectKey(obj)] = obj
	}
	for _, obj := range fewer {
		key := objectKey(obj)
		other, ok := moreByKey[key]
		if !ok {
			t.Errorf("%s: %s exists only without the removed host", provider, key)
			continue
		}
		if u, ok := obj.(*unstructured.Unstructured); ok && u.GetKind() == "Certificate" {
			continue
		}
		gateway, ok := obj.(*gwapiv1.Gateway)
		if !ok {
			if !reflect.DeepEqual(obj, other) {
				t.Errorf("%s: %s changed", provider, key)
			}
			continue
		}
		for _, listener := range gateway.Spec.Listeners {
			if !slices.ContainsFunc(other.(*gwapiv1.Gateway).Spec.Listeners, func(l gwapiv1.Listener) bool { return reflect.DeepEqual(l, listener) }) {
				t.Errorf("%s: listener %s for %s changed", provider, listener.Name, *listener.Hostname)
			}
		}
	}
}

func typedObject[T client.Object](objs []client.Object, name string) T {
	var zero T
	for _, o := range objs {
		if typed, ok := o.(T); ok && o.GetName() == name {
			return typed
		}
	}
	return zero
}

func TestGatewayProxy(t *testing.T) {
	svc := setName(publicService(), "web")
	svc.Namespace = "team"
	svc.Spec.Config.Hosts = []v1.HostSpec{
		{Host: "install.example.com", Path: "/", Proxy: &v1.HostProxySpec{To: "https://raw.githubusercontent.com/org/repo/main/install.sh"}},
		{Host: "legacy.example.com", Path: "/", Proxy: &v1.HostProxySpec{To: "http://legacy.example.net:8080"}},
	}
	labels := map[string]string{"app.kubernetes.io/instance": "web", "unbind-service": "svc-id"}
	objs, err := New(ProviderGateway, envoyConfig).BuildRoutes(RouteInput{Service: svc, Labels: labels})
	if err != nil {
		t.Fatalf("BuildRoutes: %v", err)
	}

	install := proxyUpstreamName(svc, svc.Spec.Config.Hosts[0])
	rule := httpRouteFor(objs, "install.example.com").Spec.Rules[0]
	backend := rule.BackendRefs[0].BackendObjectReference
	if string(backend.Name) != install || *backend.Port != 443 {
		t.Errorf("proxy route backend = %s:%d, want %s:443", backend.Name, *backend.Port, install)
	}
	rewrite := rule.Filters[0].URLRewrite
	if string(*rewrite.Hostname) != "raw.githubusercontent.com" {
		t.Errorf("upstream Host = %s, want the target hostname", *rewrite.Hostname)
	}
	if rewrite.Path == nil || *rewrite.Path.ReplaceFullPath != "/org/repo/main/install.sh" {
		t.Errorf("a target with a path serves that path for every request, got %+v", rewrite.Path)
	}

	service := typedObject[*corev1.Service](objs, install)
	if service == nil || service.Spec.ClusterIP != corev1.ClusterIPNone || len(service.Spec.Selector) != 0 || service.Spec.Ports[0].Port != 443 {
		t.Fatalf("upstream service = %+v, want a headless service on 443 without a selector", service)
	}
	if service.Spec.IPFamilyPolicy == nil || *service.Spec.IPFamilyPolicy != corev1.IPFamilyPolicySingleStack {
		t.Errorf("upstream must be single stack, dual stack makes Envoy resolve IPv6 upstreams")
	}
	if _, ok := service.Labels["unbind-service"]; ok || service.Labels["app.kubernetes.io/instance"] != "web" {
		t.Errorf("upstream labels = %v, want the instance label without unbind-service", service.Labels)
	}
	slice := typedObject[*discoveryv1.EndpointSlice](objs, install)
	if slice == nil || slice.AddressType != discoveryv1.AddressTypeFQDN || slice.Endpoints[0].Addresses[0] != "raw.githubusercontent.com" {
		t.Fatalf("endpoint slice = %+v, want an FQDN endpoint for the target", slice)
	}
	if slice.Labels[discoveryv1.LabelServiceName] != install || *slice.Ports[0].Name != service.Spec.Ports[0].Name {
		t.Errorf("endpoint slice does not back the upstream service: labels %v ports %+v", slice.Labels, slice.Ports)
	}
	policy := typedObject[*gwapiv1.BackendTLSPolicy](objs, install)
	if policy == nil || string(policy.Spec.Validation.Hostname) != "raw.githubusercontent.com" ||
		*policy.Spec.Validation.WellKnownCACertificates != gwapiv1.WellKnownCACertificatesSystem {
		t.Fatalf("https target needs TLS verified against the system CAs, got %+v", policy)
	}

	legacy := proxyUpstreamName(svc, svc.Spec.Config.Hosts[1])
	rule = httpRouteFor(objs, "legacy.example.com").Spec.Rules[0]
	if *rule.BackendRefs[0].Port != 8080 || rule.Filters[0].URLRewrite.Path != nil {
		t.Errorf("http target keeps its port and the request path, got port %d rewrite %+v", *rule.BackendRefs[0].Port, rule.Filters[0].URLRewrite)
	}
	if typedObject[*gwapiv1.BackendTLSPolicy](objs, legacy) != nil {
		t.Errorf("an http target must not get a TLS policy")
	}
}

func TestProxyNeedsEnvoyGateway(t *testing.T) {
	svc := setName(publicService(), "web")
	svc.Spec.Config.Hosts = append(svc.Spec.Config.Hosts, v1.HostSpec{
		Host: "install.example.com", Path: "/", Proxy: &v1.HostProxySpec{To: "https://raw.githubusercontent.com/install.sh"},
	})
	for name, provider := range map[string]NetworkingProvider{
		"gateway without envoy": New(ProviderGateway, Config{GatewayClassName: "unbind", ClusterIssuer: "le"}),
		"nginx":                 New(ProviderNginx, Config{}),
		"traefik":               New(ProviderTraefik, Config{}),
	} {
		t.Run(name, func(t *testing.T) {
			objs, err := provider.BuildRoutes(RouteInput{Service: svc})
			if err != nil {
				t.Fatalf("BuildRoutes: %v", err)
			}
			if httpRouteFor(objs, "install.example.com") != nil || ingressFor(objs, "install.example.com") != nil {
				t.Errorf("a proxied host must not be routed to the service")
			}
			if httpRouteFor(objs, "example.com") == nil && ingressFor(objs, "example.com") == nil {
				t.Errorf("the other host lost its route")
			}
			if gw := findGateway(objs); gw != nil && len(gw.Spec.Listeners) != 1 {
				t.Errorf("listeners = %v, want only the routed host", gw.Spec.Listeners)
			}
		})
	}
}

func TestProxyUpstreamName(t *testing.T) {
	host := v1.HostSpec{Host: "install.example.com"}
	long := setName(publicService(), strings.Repeat("a", 32)+"-abcdefghijkl")
	name := proxyUpstreamName(long, host)
	if len(name) > 63 || !IsRouteObjectName("Service", name) || !IsRouteObjectName("EndpointSlice", name) {
		t.Errorf("upstream name %q must be a valid Service name the route cleanup recognizes", name)
	}
	if proxyUpstreamName(setName(publicService(), "other"), host) == name {
		t.Errorf("two services in one namespace must not share an upstream for the same domain")
	}
	for _, kept := range []string{long.Name, long.Name + "-nodeport", long.Name + "-db", "proxy-" + strings.Repeat("a", 12), "proxy-abc"} {
		if IsRouteObjectName("Service", kept) {
			t.Errorf("%q is not a proxy upstream and must survive route cleanup", kept)
		}
	}
}
