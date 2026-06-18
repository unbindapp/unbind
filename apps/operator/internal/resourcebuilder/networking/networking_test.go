package networking

import (
	"testing"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/utils/ptr"
	gwapiv1 "sigs.k8s.io/gateway-api/apis/v1"
)

func publicService() *v1.Service {
	return &v1.Service{
		Spec: v1.ServiceSpec{
			Name: "web",
			Config: v1.ServiceConfigSpec{
				Public: true,
				Hosts:  []v1.HostSpec{{Host: "example.com", Path: "/"}},
				Ports:  []v1.PortSpec{{Port: 8080}},
			},
		},
	}
}

func setName(svc *v1.Service, name string) *v1.Service {
	svc.Name = name
	svc.Spec.Name = name
	return svc
}

func TestNeedsRoutesGuards(t *testing.T) {
	cases := map[string]func(*v1.Service){
		"not public": func(s *v1.Service) { s.Spec.Config.Public = false },
		"no hosts":   func(s *v1.Service) { s.Spec.Config.Hosts = nil },
		"no ports":   func(s *v1.Service) { s.Spec.Config.Ports = nil },
	}
	for name, mutate := range cases {
		svc := setName(publicService(), "web")
		mutate(svc)
		if _, err := New(ProviderNginx, Config{}).BuildRoutes(RouteInput{Service: svc}); err != ErrRouteNotNeeded {
			t.Errorf("%s: expected ErrRouteNotNeeded, got %v", name, err)
		}
	}
}

// TestNginxParity pins the nginx Ingress output so existing clusters never churn.
func TestNginxParity(t *testing.T) {
	svc := setName(publicService(), "web")
	objs, err := New(ProviderNginx, Config{}).BuildRoutes(RouteInput{Service: svc})
	if err != nil {
		t.Fatalf("BuildRoutes: %v", err)
	}
	if len(objs) != 1 {
		t.Fatalf("expected 1 object, got %d", len(objs))
	}
	ing, ok := objs[0].(*networkingv1.Ingress)
	if !ok {
		t.Fatalf("expected *Ingress, got %T", objs[0])
	}

	if got := ptr.Deref(ing.Spec.IngressClassName, ""); got != "nginx" {
		t.Errorf("ingressClassName = %q, want nginx", got)
	}
	if got := ing.Spec.TLS[0].SecretName; got != "web-tls-secret" {
		t.Errorf("tls secret = %q, want web-tls-secret", got)
	}
	if got := *ing.Spec.Rules[0].HTTP.Paths[0].PathType; got != networkingv1.PathTypePrefix {
		t.Errorf("pathType = %q, want Prefix", got)
	}
	if got := ing.Spec.Rules[0].HTTP.Paths[0].Backend.Service.Port.Number; got != 8080 {
		t.Errorf("backend port = %d, want 8080", got)
	}

	want := map[string]string{
		"kubernetes.io/tls-acme":                             "true",
		"nginx.ingress.kubernetes.io/eventsource":            "true",
		"nginx.ingress.kubernetes.io/add-base-url":           "true",
		"nginx.ingress.kubernetes.io/ssl-redirect":           "true",
		"nginx.ingress.kubernetes.io/websocket-services":     "web-service",
		"nginx.ingress.kubernetes.io/proxy-send-timeout":     "1800",
		"nginx.ingress.kubernetes.io/proxy-read-timeout":     "21600",
		"nginx.ingress.kubernetes.io/proxy-body-size":        "10m",
		"nginx.ingress.kubernetes.io/upstream-hash-by":       "$realip_remote_addr",
		"nginx.ingress.kubernetes.io/affinity":               "cookie",
		"nginx.ingress.kubernetes.io/session-cookie-name":    "web-session",
		"nginx.ingress.kubernetes.io/session-cookie-expires": "172800",
		"nginx.ingress.kubernetes.io/session-cookie-max-age": "172800",
	}
	if len(ing.Annotations) != len(want) {
		t.Errorf("annotation count = %d, want %d", len(ing.Annotations), len(want))
	}
	for k, v := range want {
		if ing.Annotations[k] != v {
			t.Errorf("annotation %q = %q, want %q", k, ing.Annotations[k], v)
		}
	}
}

func TestTraefikRoutes(t *testing.T) {
	svc := setName(publicService(), "web")
	objs, err := New(ProviderTraefik, Config{}).BuildRoutes(RouteInput{Service: svc})
	if err != nil {
		t.Fatalf("BuildRoutes: %v", err)
	}
	if len(objs) != 3 {
		t.Fatalf("expected ingress + 2 middlewares, got %d", len(objs))
	}
	ing, ok := objs[0].(*networkingv1.Ingress)
	if !ok {
		t.Fatalf("expected *Ingress, got %T", objs[0])
	}
	if got := ptr.Deref(ing.Spec.IngressClassName, ""); got != "traefik" {
		t.Errorf("ingressClassName = %q, want traefik", got)
	}
	for _, mw := range objs[1:] {
		if _, ok := mw.(*unstructured.Unstructured); !ok {
			t.Errorf("expected middleware to be unstructured, got %T", mw)
		}
	}
}

func TestGatewayRoutes(t *testing.T) {
	svc := setName(publicService(), "web")
	cfg := Config{GatewayClassName: "unbind", ClusterIssuer: "letsencrypt-prod", GatewayControllerEnvoy: true}
	objs, err := New(ProviderGateway, cfg).BuildRoutes(RouteInput{Service: svc})
	if err != nil {
		t.Fatalf("BuildRoutes: %v", err)
	}
	// Gateway + HTTPRoute + BackendTrafficPolicy
	if len(objs) != 3 {
		t.Fatalf("expected gateway + httproute + policy, got %d", len(objs))
	}

	gw, ok := objs[0].(*gwapiv1.Gateway)
	if !ok {
		t.Fatalf("expected *Gateway, got %T", objs[0])
	}
	if got := string(gw.Spec.GatewayClassName); got != "unbind" {
		t.Errorf("gatewayClassName = %q, want unbind", got)
	}
	if got := gw.Annotations["cert-manager.io/cluster-issuer"]; got != "letsencrypt-prod" {
		t.Errorf("cluster-issuer annotation = %q, want letsencrypt-prod", got)
	}
	if len(gw.Spec.Listeners) != 1 || string(*gw.Spec.Listeners[0].Hostname) != "example.com" {
		t.Errorf("expected one https listener for example.com, got %+v", gw.Spec.Listeners)
	}
	if got := string(gw.Spec.Listeners[0].TLS.CertificateRefs[0].Name); got != "web-tls-secret" {
		t.Errorf("listener certRef = %q, want web-tls-secret", got)
	}

	route, ok := objs[1].(*gwapiv1.HTTPRoute)
	if !ok {
		t.Fatalf("expected *HTTPRoute, got %T", objs[1])
	}
	if got := string(route.Spec.ParentRefs[0].Name); got != "web" {
		t.Errorf("parentRef name = %q, want web (per-service gateway)", got)
	}
	if got := string(route.Spec.Hostnames[0]); got != "example.com" {
		t.Errorf("hostname = %q, want example.com", got)
	}

	// Without envoy controller, no policy object is emitted (gateway + route only).
	objs, _ = New(ProviderGateway, Config{GatewayClassName: "unbind", ClusterIssuer: "x"}).BuildRoutes(RouteInput{Service: svc})
	if len(objs) != 2 {
		t.Errorf("expected gateway + httproute without envoy, got %d objects", len(objs))
	}
}
