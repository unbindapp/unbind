package resourcebuilder

import (
	"fmt"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// Resourcebuilder is responsible for building native k8s resources
type ResourceBuilder struct {
	service *v1.Service
	scheme  *runtime.Scheme
}

func NewResourceBuilder(service *v1.Service, scheme *runtime.Scheme) *ResourceBuilder {
	return &ResourceBuilder{
		service: service,
		scheme:  scheme,
	}
}

func (rb *ResourceBuilder) buildObjectMeta() metav1.ObjectMeta {
	return metav1.ObjectMeta{
		Name:      rb.service.Name,
		Namespace: rb.service.Namespace,
		Labels:    rb.getCommonLabels(),
	}
}

// Base labels for match selector, these are immutable labels
func (rb *ResourceBuilder) getLabelSelectors() map[string]string {
	return map[string]string{
		"app.kubernetes.io/name":       rb.service.Name,
		"app.kubernetes.io/instance":   rb.service.Name,
		"app.kubernetes.io/managed-by": "unbind-operator",
	}
}

// getCommonLabels returns labels that should be applied to all resources
func (rb *ResourceBuilder) getCommonLabels() map[string]string {
	labels := rb.getLabelSelectors()

	labels["unbind-team"] = rb.service.Spec.TeamRef
	labels["unbind-project"] = rb.service.Spec.ProjectRef
	labels["unbind-service"] = rb.service.Spec.ServiceRef
	labels["unbind-environment"] = rb.service.Spec.EnvironmentRef
	labels["unbind-deployment"] = rb.service.Spec.DeploymentRef

	if rb.service.Spec.Provider != "" {
		labels["unbind-provider"] = rb.service.Spec.Provider
	}

	if rb.service.Spec.Framework != "" {
		labels["unbind-framework"] = rb.service.Spec.Framework
	}

	return labels
}

func (rb *ResourceBuilder) buildPodAnnotations() map[string]string {
	return map[string]string{}
}

func (rb *ResourceBuilder) buildIngressAnnotations() map[string]string {
	return map[string]string{
		"kubernetes.io/tls-acme":                             "true",
		"nginx.ingress.kubernetes.io/eventsource":            "true",
		"nginx.ingress.kubernetes.io/add-base-url":           "true",
		"nginx.ingress.kubernetes.io/ssl-redirect":           "true",
		"nginx.ingress.kubernetes.io/websocket-services":     fmt.Sprintf("%s-service", rb.service.Name),
		"nginx.ingress.kubernetes.io/proxy-send-timeout":     "1800",
		"nginx.ingress.kubernetes.io/proxy-read-timeout":     "21600",
		"nginx.ingress.kubernetes.io/proxy-body-size":        "10m",
		"nginx.ingress.kubernetes.io/upstream-hash-by":       "$realip_remote_addr",
		"nginx.ingress.kubernetes.io/affinity":               "cookie",
		"nginx.ingress.kubernetes.io/session-cookie-name":    fmt.Sprintf("%s-session", rb.service.Name),
		"nginx.ingress.kubernetes.io/session-cookie-expires": "172800",
		"nginx.ingress.kubernetes.io/session-cookie-max-age": "172800",
	}
}
