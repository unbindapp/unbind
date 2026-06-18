package networking

import (
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// buildIngress assembles a classic networking.k8s.io/v1 Ingress, shared by the
// nginx and traefik providers which differ only by class name and annotations.
func buildIngress(in RouteInput, className string, annotations map[string]string) *networkingv1.Ingress {
	svc := in.Service
	pathType := networkingv1.PathTypePrefix

	rules := make([]networkingv1.IngressRule, len(svc.Spec.Config.Hosts))
	tlsHosts := make([]string, len(svc.Spec.Config.Hosts))
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
		tlsHosts[i] = host.Host
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
			TLS: []networkingv1.IngressTLS{{
				Hosts:      tlsHosts,
				SecretName: tlsSecretName(svc),
			}},
			Rules: rules,
		},
	}
}
