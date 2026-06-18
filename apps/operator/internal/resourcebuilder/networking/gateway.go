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
)

type gatewayProvider struct {
	cfg Config
}

func (gatewayProvider) Name() Provider { return ProviderGateway }

func (gatewayProvider) ServiceAnnotations(*v1.Service) map[string]string { return nil }

// BuildRoutes emits a per-service Gateway plus an HTTPRoute. The Gateway carries
// one HTTPS listener per host with a shared certificateRef and the cert-manager
// cluster-issuer annotation, so the gateway-shim issues a per-host certificate
// over HTTP-01 (no wildcard cert, no DNS-01). With mergeGateways enabled on the
// GatewayClass, every service Gateway shares one Envoy fleet and one LB IP.
func (p gatewayProvider) BuildRoutes(in RouteInput) ([]client.Object, error) {
	svc := in.Service
	if !needsRoutes(svc) {
		return nil, ErrRouteNotNeeded
	}

	hostnames := make([]gwapiv1.Hostname, len(svc.Spec.Config.Hosts))
	listeners := make([]gwapiv1.Listener, len(svc.Spec.Config.Hosts))
	rules := make([]gwapiv1.HTTPRouteRule, len(svc.Spec.Config.Hosts))
	for i, host := range svc.Spec.Config.Hosts {
		port, path := resolveHostPort(svc, host)
		hostnames[i] = gwapiv1.Hostname(host.Host)
		listeners[i] = gwapiv1.Listener{
			Name:     gwapiv1.SectionName(fmt.Sprintf("https-%d", i)),
			Hostname: ptr.To(gwapiv1.Hostname(host.Host)),
			Port:     443,
			Protocol: gwapiv1.HTTPSProtocolType,
			TLS: &gwapiv1.ListenerTLSConfig{
				Mode: ptr.To(gwapiv1.TLSModeTerminate),
				CertificateRefs: []gwapiv1.SecretObjectReference{{
					Name: gwapiv1.ObjectName(tlsSecretName(svc)),
				}},
			},
			AllowedRoutes: &gwapiv1.AllowedRoutes{
				Namespaces: &gwapiv1.RouteNamespaces{From: ptr.To(gwapiv1.NamespacesFromSame)},
			},
		}
		rules[i] = gwapiv1.HTTPRouteRule{
			Matches: []gwapiv1.HTTPRouteMatch{{
				Path: &gwapiv1.HTTPPathMatch{
					Type:  ptr.To(gwapiv1.PathMatchPathPrefix),
					Value: ptr.To(path),
				},
			}},
			BackendRefs: []gwapiv1.HTTPBackendRef{{
				BackendRef: gwapiv1.BackendRef{
					BackendObjectReference: gwapiv1.BackendObjectReference{
						Name: gwapiv1.ObjectName(svc.Name),
						Port: ptr.To(gwapiv1.PortNumber(port)),
					},
				},
			}},
			Timeouts: &gwapiv1.HTTPRouteTimeouts{
				Request: ptr.To(gwapiv1.Duration("21600s")),
			},
		}
	}

	gateway := &gwapiv1.Gateway{
		ObjectMeta: metav1.ObjectMeta{
			Name:        svc.Name,
			Namespace:   svc.Namespace,
			Labels:      in.Labels,
			Annotations: map[string]string{"cert-manager.io/cluster-issuer": p.cfg.ClusterIssuer},
		},
		Spec: gwapiv1.GatewaySpec{
			GatewayClassName: gwapiv1.ObjectName(p.cfg.GatewayClassName),
			Listeners:        listeners,
		},
	}

	route := &gwapiv1.HTTPRoute{
		ObjectMeta: metav1.ObjectMeta{
			Name:      svc.Name,
			Namespace: svc.Namespace,
			Labels:    in.Labels,
		},
		Spec: gwapiv1.HTTPRouteSpec{
			CommonRouteSpec: gwapiv1.CommonRouteSpec{
				ParentRefs: []gwapiv1.ParentReference{{
					Group: ptr.To(gwapiv1.Group("gateway.networking.k8s.io")),
					Kind:  ptr.To(gwapiv1.Kind("Gateway")),
					Name:  gwapiv1.ObjectName(svc.Name),
				}},
			},
			Hostnames: hostnames,
			Rules:     rules,
		},
	}

	objects := []client.Object{gateway, route}
	if p.cfg.GatewayControllerEnvoy {
		objects = append(objects, envoyAffinityPolicy(in))
	}
	return objects, nil
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
				"type": "Cookie",
				"cookie": map[string]any{
					"name": fmt.Sprintf("%s-session", svc.Name),
					"ttl":  "172800s",
				},
			},
		},
	}
	return u
}
