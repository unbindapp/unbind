package networking

import (
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

// splitHosts separates the hosts the shared Ingress serves from the ones that need
// an Ingress of their own, since the ingress controllers read options per Ingress.
// Proxied hosts are left out, only Envoy Gateway serves them.
func splitHosts(svc *v1.Service) (plain, optioned []v1.HostSpec) {
	for _, host := range svc.Spec.Config.Hosts {
		if host.Proxy != nil {
			continue
		}
		if hasRouteOptions(host) {
			optioned = append(optioned, host)
			continue
		}
		plain = append(plain, host)
	}
	return plain, optioned
}

// buildIngress assembles a classic networking.k8s.io/v1 Ingress, shared by the
// nginx and traefik providers which differ only by class name and annotations.
// Hosts needing ACME share acmeSecret, wildcard hosts the service's wildcard secret.
func buildIngress(in RouteInput, name, className string, annotations map[string]string, hosts []v1.HostSpec, acmeSecret string) *networkingv1.Ingress {
	svc := in.Service
	pathType := networkingv1.PathTypePrefix

	rules := make([]networkingv1.IngressRule, len(hosts))
	var acmeHosts, wildcardTLSHosts []string
	for i, host := range hosts {
		port, path := resolveHostPort(svc, host)
		rules[i] = networkingv1.IngressRule{
			Host: host.Host,
			IngressRuleValue: networkingv1.IngressRuleValue{
				HTTP: &networkingv1.HTTPIngressRuleValue{
					Paths: []networkingv1.HTTPIngressPath{{
						Path:     path,
						PathType: &pathType,
						Backend: networkingv1.IngressBackend{
							Service: &networkingv1.IngressServiceBackend{
								Name: svc.Name,
								Port: networkingv1.ServiceBackendPort{
									Number: port,
								},
							},
						},
					}},
				},
			},
		}
		if isWildcardHost(host) {
			wildcardTLSHosts = append(wildcardTLSHosts, host.Host)
			continue
		}
		acmeHosts = append(acmeHosts, host.Host)
	}

	var tls []networkingv1.IngressTLS
	if len(acmeHosts) > 0 {
		tls = append(tls, networkingv1.IngressTLS{Hosts: acmeHosts, SecretName: acmeSecret})
	}
	if len(wildcardTLSHosts) > 0 {
		tls = append(tls, networkingv1.IngressTLS{Hosts: wildcardTLSHosts, SecretName: wildcardTLSSecretName(svc)})
	}

	class := className
	return &networkingv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{
			Name:        name,
			Namespace:   svc.Namespace,
			Labels:      in.Labels,
			Annotations: annotations,
		},
		Spec: networkingv1.IngressSpec{
			IngressClassName: &class,
			TLS:              tls,
			Rules:            rules,
		},
	}
}

// ingressRoutes puts the wildcard Certificate ahead of the Ingresses: cert-manager's
// ingress-shim leaves a TLS secret alone once a Certificate it doesn't own claims it,
// otherwise it would order the wildcard from Let's Encrypt.
func ingressRoutes(cfg Config, in RouteInput, objects ...client.Object) []client.Object {
	var all []client.Object
	if wildcards := wildcardHosts(in.Service.Spec.Config.Hosts); len(wildcards) > 0 {
		all = append(all, wildcardCertificate(cfg, in.Service, in.Labels, wildcards))
	}
	return append(all, objects...)
}
