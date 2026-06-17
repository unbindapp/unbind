package resourcebuilder

import (
	"fmt"
	"strings"

	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var ErrIngressNotNeeded = fmt.Errorf("ingress not needed, probably no domain configured")

func (rb *ResourceBuilder) BuildIngress() (*networkingv1.Ingress, error) {
	if len(rb.service.Spec.Config.Hosts) < 1 || len(rb.service.Spec.Config.Ports) < 1 || !rb.service.Spec.Config.Public {
		return nil, ErrIngressNotNeeded
	}

	pathType := networkingv1.PathTypePrefix

	ingressRules := make([]networkingv1.IngressRule, len(rb.service.Spec.Config.Hosts))
	tlsHosts := make([]string, len(rb.service.Spec.Config.Hosts))
	for i, host := range rb.service.Spec.Config.Hosts {
		// Default to first service port if not specified
		port := rb.service.Spec.Config.Ports[0].Port
		if host.Port != nil {
			port = *host.Port
		}
		// Default to "/" if no path specified
		path := "/"
		if host.Path != "" {
			path = host.Path
		}
		ingressRules[i] = networkingv1.IngressRule{
			Host: host.Host,
			IngressRuleValue: networkingv1.IngressRuleValue{
				HTTP: &networkingv1.HTTPIngressRuleValue{
					Paths: []networkingv1.HTTPIngressPath{{
						Path:     path,
						PathType: &pathType,
						Backend: networkingv1.IngressBackend{
							Service: &networkingv1.IngressServiceBackend{
								Name: rb.service.Name,
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

	ingressClass := "nginx"
	ingress := &networkingv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{
			Name:        rb.service.Name,
			Namespace:   rb.service.Namespace,
			Labels:      rb.getCommonLabels(),
			Annotations: rb.buildIngressAnnotations(),
		},
		Spec: networkingv1.IngressSpec{
			IngressClassName: &ingressClass,
			TLS: []networkingv1.IngressTLS{{
				Hosts:      tlsHosts,
				SecretName: fmt.Sprintf("%s-tls-secret", strings.ToLower(rb.service.Name)),
			}},
			Rules: ingressRules,
		},
	}

	return ingress, nil
}
