package controller

import (
	"testing"

	"github.com/go-logr/logr"
	"github.com/stretchr/testify/assert"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
)

func TestIngressNeedsUpdate(t *testing.T) {
	ingress := func(hosts ...string) *networkingv1.Ingress {
		ing := &networkingv1.Ingress{}
		for _, host := range hosts {
			ing.Spec.Rules = append(ing.Spec.Rules, networkingv1.IngressRule{Host: host})
		}
		ing.Spec.TLS = []networkingv1.IngressTLS{{Hosts: hosts, SecretName: "app-tls-secret"}}
		return ing
	}

	assert.False(t, ingressNeedsUpdate(ingress("a.com", "b.com"), ingress("a.com", "b.com")))
	assert.True(t, ingressNeedsUpdate(ingress("a.com", "b.com"), ingress("a.com")))
	assert.True(t, ingressNeedsUpdate(ingress("a.com"), ingress("b.com")))
	assert.True(t, ingressNeedsUpdate(ingress("a.com"), ingress("a.com", "b.com")))

	withBodySize := func(size string) *networkingv1.Ingress {
		ing := ingress("a.com")
		ing.Annotations = map[string]string{"nginx.ingress.kubernetes.io/proxy-body-size": size}
		return ing
	}
	assert.False(t, ingressNeedsUpdate(withBodySize("100m"), withBodySize("100m")))
	assert.True(t, ingressNeedsUpdate(withBodySize("10m"), withBodySize("100m")))
	assert.True(t, ingressNeedsUpdate(ingress("a.com"), withBodySize("100m")))
	assert.True(t, ingressNeedsUpdate(withBodySize("100m"), ingress("a.com")))

	stamped := withBodySize("100m")
	stamped.Annotations[renderHashAnnotation] = "hash"
	assert.False(t, ingressNeedsUpdate(stamped, withBodySize("100m")), "the render hash on the live ingress is not a change")
	assert.True(t, ingressNeedsUpdate(stamped, ingress("a.com")))
}

func TestKubeServiceNeedsUpdateOnRemovedPort(t *testing.T) {
	service := func(ports ...int32) *corev1.Service {
		svc := &corev1.Service{}
		for _, port := range ports {
			svc.Spec.Ports = append(svc.Spec.Ports, corev1.ServicePort{Port: port})
		}
		return svc
	}

	assert.False(t, kubeServiceNeedsUpdate(logr.Discard(), service(80, 443), service(80, 443)))
	assert.True(t, kubeServiceNeedsUpdate(logr.Discard(), service(80), service(80, 443)))
}

func TestKubeServiceNeedsUpdateOnAnnotations(t *testing.T) {
	sticky := func() *corev1.Service {
		svc := &corev1.Service{}
		svc.Annotations = map[string]string{"traefik.ingress.kubernetes.io/service.sticky.cookie": "true"}
		return svc
	}

	assert.False(t, kubeServiceNeedsUpdate(logr.Discard(), sticky(), sticky()))
	assert.False(t, kubeServiceNeedsUpdate(logr.Discard(), &corev1.Service{}, &corev1.Service{}))
	assert.True(t, kubeServiceNeedsUpdate(logr.Discard(), &corev1.Service{}, sticky()))
	assert.True(t, kubeServiceNeedsUpdate(logr.Discard(), sticky(), &corev1.Service{}))

	stamped := func(svc *corev1.Service) *corev1.Service {
		if svc.Annotations == nil {
			svc.Annotations = map[string]string{}
		}
		svc.Annotations[renderHashAnnotation] = "hash"
		return svc
	}
	assert.False(t, kubeServiceNeedsUpdate(logr.Discard(), &corev1.Service{}, stamped(&corev1.Service{})), "the render hash on the live service is not a change")
	assert.False(t, kubeServiceNeedsUpdate(logr.Discard(), sticky(), stamped(sticky())))
	assert.True(t, kubeServiceNeedsUpdate(logr.Discard(), &corev1.Service{}, stamped(sticky())))
}
