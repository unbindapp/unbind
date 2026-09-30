package networking

import (
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

// buildIngress assembles a classic networking.k8s.io/v1 Ingress, shared by the
// nginx and traefik providers which differ only by class name and annotations.
func buildIngress(in RouteInput, className string, annotations map[string]string) *networkingv1.Ingress {
	svc := in.Service
	pathType := networkingv1.PathTypePrefix

	rules := make([]networkingv1.IngressRule, len(svc.Spec.Config.Hosts))
	var acmeHosts, wildcardTLSHosts []string
	for i, host := range svc.Spec.Config.Hosts {
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
		tls = append(tls, networkingv1.IngressTLS{Hosts: acmeHosts, SecretName: tlsSecretName(svc)})
	}
	if len(wildcardTLSHosts) > 0 {
		tls = append(tls, networkingv1.IngressTLS{Hosts: wildcardTLSHosts, SecretName: wildcardTLSSecretName(svc)})
	}

	class := className
	return &networkingv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{
			Name:        svc.Name,
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

// ingressRoutes puts the wildcard Certificate ahead of the Ingress: cert-manager's
// ingress-shim leaves a TLS secret alone once a Certificate it doesn't own claims it,
// otherwise it would order the wildcard from Let's Encrypt.
func ingressRoutes(cfg Config, in RouteInput, ingress *networkingv1.Ingress, extra ...client.Object) []client.Object {
	var objects []client.Object
	if wildcards := wildcardHosts(in.Service.Spec.Config.Hosts); len(wildcards) > 0 {
		objects = append(objects, wildcardCertificate(cfg, in.Service, in.Labels, wildcards))
	}
	objects = append(objects, ingress)
	return append(objects, extra...)
}
