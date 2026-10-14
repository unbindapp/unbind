package networking

import (
	"crypto/sha256"
	"fmt"
	"maps"
	"testing"
	"time"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func serviceOn(name string, created time.Time, hosts ...v1.HostSpec) v1.Service {
	svc := setName(publicService(), name)
	svc.Namespace = "team"
	svc.CreationTimestamp = metav1.NewTime(created)
	svc.Spec.Config.Hosts = hosts
	return *svc
}

func TestListenerGateways(t *testing.T) {
	older, newer := time.Unix(100, 0), time.Unix(200, 0)
	root := v1.HostSpec{Host: "example.com", Path: "/"}
	inquire := v1.HostSpec{Host: "Example.com", Path: "/inquire"}
	api := v1.HostSpec{Host: "example.com", Path: "/api/"}

	deleting := serviceOn("frontend", newer, root)
	deleting.DeletionTimestamp = &metav1.Time{Time: newer}
	cron := serviceOn("frontend", newer, root)
	cron.Spec.Config.CronSchedule = "*/5 * * * *"
	private := serviceOn("frontend", newer, root)
	private.Spec.Config.Public = false
	grpc := serviceOn("frontend", newer, v1.HostSpec{Host: "example.com", Protocol: "grpc"})
	proxied := serviceOn("frontend", newer, v1.HostSpec{Host: "example.com", Proxy: &v1.HostProxySpec{To: "https://example.net"}})

	tests := []struct {
		name   string
		svc    v1.Service
		others []v1.Service
		want   map[string]string
	}{
		{"alone", serviceOn("inquire", older, inquire), nil, map[string]string{}},
		{"the whole domain owns it, however new", serviceOn("inquire", older, inquire), []v1.Service{serviceOn("frontend", newer, root)}, map[string]string{"example.com": "frontend"}},
		{"the owner of the whole domain keeps it", serviceOn("frontend", newer, root), []v1.Service{serviceOn("inquire", older, inquire)}, map[string]string{}},
		{"without the whole domain the oldest owns it", serviceOn("api", newer, api), []v1.Service{serviceOn("inquire", older, inquire)}, map[string]string{"example.com": "inquire"}},
		{"the same age goes by name", serviceOn("inquire", older, inquire), []v1.Service{serviceOn("api", older, api)}, map[string]string{"example.com": "api"}},
		{"another hostname is not shared", serviceOn("inquire", older, inquire), []v1.Service{serviceOn("frontend", newer, v1.HostSpec{Host: "www.example.com", Path: "/"})}, map[string]string{}},
		{"a service being deleted gives it up", serviceOn("inquire", older, inquire), []v1.Service{deleting}, map[string]string{}},
		{"a cron service routes nothing", serviceOn("inquire", older, inquire), []v1.Service{cron}, map[string]string{}},
		{"a private service routes nothing", serviceOn("inquire", older, inquire), []v1.Service{private}, map[string]string{}},
		{"a grpc host does not share", serviceOn("inquire", older, inquire), []v1.Service{grpc}, map[string]string{}},
		{"a proxy routes the whole domain", serviceOn("inquire", older, inquire), []v1.Service{proxied}, map[string]string{"example.com": "frontend"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			namespace := append([]v1.Service{tt.svc}, tt.others...)
			got := ListenerGateways(envoyConfig, &tt.svc, namespace)
			if !maps.Equal(got, tt.want) {
				t.Errorf("ListenerGateways = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestGatewaySharedHostname(t *testing.T) {
	inquire := setName(publicService(), "inquire")
	inquire.Spec.Config.Hosts = []v1.HostSpec{{Host: "example.com", Path: "/inquire"}}
	objs, err := New(ProviderGateway, envoyConfig).BuildRoutes(RouteInput{Service: inquire, ListenerGateways: map[string]string{"example.com": "frontend"}})
	if err != nil {
		t.Fatalf("BuildRoutes: %v", err)
	}
	if findGateway(objs) != nil || findCertificate(objs) != nil {
		t.Fatalf("a service on another service's listener needs no Gateway or Certificate of its own")
	}
	route := httpRouteFor(objs, "example.com")
	parent := route.Spec.ParentRefs[0]
	if parent.Name != "frontend" || *parent.SectionName != hostListenerName(v1.HostSpec{Host: "example.com"}) {
		t.Errorf("route parent = %s/%s, want the frontend listener", parent.Name, *parent.SectionName)
	}
	if got := *route.Spec.Rules[0].Matches[0].Path.Value; got != "/inquire" {
		t.Errorf("route path = %q, want /inquire", got)
	}

	server := setName(publicService(), "server")
	server.Spec.Config.Hosts = []v1.HostSpec{{Host: "example.com", Path: "/api"}, {Host: "example.com", Path: "/socket.io"}, {Host: "api.example.com", Path: "/"}}
	objs, err = New(ProviderGateway, envoyConfig).BuildRoutes(RouteInput{Service: server, ListenerGateways: map[string]string{"example.com": "website"}})
	if err != nil {
		t.Fatalf("BuildRoutes: %v", err)
	}
	gateway := findGateway(objs)
	if gateway == nil || len(gateway.Spec.Listeners) != 1 || string(*gateway.Spec.Listeners[0].Hostname) != "api.example.com" {
		t.Fatalf("expected only the api.example.com listener, got %v", gateway)
	}
	assertCertificate(t, findCertificate(objs), "le", "api.example.com")
	if routes := httpRoutesByName(objs); len(routes) != 3 {
		t.Errorf("expected a route per path, got %v", routes)
	}
}

func TestGatewayPathsOnOneHostname(t *testing.T) {
	svc := setName(publicService(), "web")
	svc.Spec.Config.SessionAffinity = true
	svc.Spec.Config.Hosts = []v1.HostSpec{{Host: "example.com", Path: "/"}, {Host: "example.com", Path: "/api"}}
	objs, err := New(ProviderGateway, envoyConfig).BuildRoutes(RouteInput{Service: svc})
	if err != nil {
		t.Fatalf("BuildRoutes: %v", err)
	}
	if listeners := findGateway(objs).Spec.Listeners; len(listeners) != 1 {
		t.Errorf("expected one listener for the hostname, got %d", len(listeners))
	}
	assertCertificate(t, findCertificate(objs), "le", "example.com")
	routes := httpRoutesByName(objs)
	if len(routes) != 2 {
		t.Fatalf("expected a route per path, got %v", routes)
	}
	for _, route := range routes {
		if route.Spec.ParentRefs[0].Name != "web" {
			t.Errorf("route %s binds %s, want its own Gateway", route.Name, route.Spec.ParentRefs[0].Name)
		}
	}
	refs, _, _ := unstructured.NestedSlice(findKind(objs, "BackendTrafficPolicy").Object, "spec", "targetRefs")
	if len(refs) != 2 {
		t.Errorf("affinity policy should target both routes, got %v", refs)
	}
}

func TestWholeDomainNamesFollowTheHostname(t *testing.T) {
	svc := setName(publicService(), "web")
	hostname := fmt.Sprintf("%x", sha256.Sum256([]byte("example.com")))[:10]
	for _, path := range []string{"", "/"} {
		host := v1.HostSpec{Host: "Example.com", Path: path}
		if got := hostObjectName(svc, host); got != "web-host-"+hostname {
			t.Errorf("path %q: route name = %s, want web-host-%s", path, got, hostname)
		}
		proxy := fmt.Sprintf("proxy-%x", sha256.Sum256([]byte("web/example.com")))[:16]
		if got := proxyUpstreamName(svc, host); got != proxy {
			t.Errorf("path %q: proxy upstream = %s, want %s", path, got, proxy)
		}
	}
	whole, api := v1.HostSpec{Host: "example.com"}, v1.HostSpec{Host: "example.com", Path: "/api/"}
	if hostObjectName(svc, api) == hostObjectName(svc, whole) || proxyUpstreamName(svc, api) == proxyUpstreamName(svc, whole) {
		t.Errorf("a path must get names of its own")
	}
	if hostListenerName(api) != hostListenerName(whole) {
		t.Errorf("paths of one hostname share its listener")
	}
}

func TestIngressPathsOnOneHostname(t *testing.T) {
	for _, provider := range []Provider{ProviderNginx, ProviderTraefik} {
		svc := setName(publicService(), "web")
		svc.Spec.Config.Hosts = []v1.HostSpec{
			{Host: "example.com", Path: "/"},
			{Host: "example.com", Path: "/api"},
			{Host: "example.com", Path: "/admin", BasicAuth: &v1.HostBasicAuthSpec{Username: "u", PasswordHash: "h"}},
			{Host: "example.com", Path: "/old", Redirect: &v1.HostRedirectSpec{To: "https://example.com/new", StatusCode: 301}},
		}
		objs, err := New(provider, envoyConfig).BuildRoutes(RouteInput{Service: svc})
		if err != nil {
			t.Fatalf("%s BuildRoutes: %v", provider, err)
		}
		ingresses := ingressesByName(objs)
		shared := ingresses["web"]
		if shared == nil || len(shared.Spec.Rules) != 2 {
			t.Fatalf("%s: expected the shared Ingress to route both plain paths, got %v", provider, shared)
		}
		if got := shared.Spec.TLS[0].Hosts; len(got) != 1 || got[0] != "example.com" {
			t.Errorf("%s: TLS hosts = %v, want example.com once", provider, got)
		}
		if len(ingresses) != 3 {
			t.Errorf("%s: expected an Ingress per optioned path, got %v", provider, ingresses)
		}
		for name, ingress := range ingresses {
			if name == "web" {
				continue
			}
			path := ingress.Spec.Rules[0].HTTP.Paths[0]
			if path.Path != "/admin" && path.Path != "/old" {
				t.Errorf("%s: %s routes %s", provider, name, path.Path)
			}
			if *path.PathType != networkingv1.PathTypePrefix {
				t.Errorf("%s: %s path type = %s", provider, name, *path.PathType)
			}
		}
	}
}

func TestHostURL(t *testing.T) {
	for _, tt := range []struct{ path, want string }{
		{"", "https://example.com"},
		{"/", "https://example.com"},
		{"/inquire/", "https://example.com/inquire"},
		{"/socket.io", "https://example.com/socket.io"},
	} {
		if got := HostURL(v1.HostSpec{Host: "example.com", Path: tt.path}); got != tt.want {
			t.Errorf("HostURL(%q) = %s, want %s", tt.path, got, tt.want)
		}
	}
}
