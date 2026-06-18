package resourcebuilder

import (
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	"github.com/unbindapp/unbind-operator/internal/resourcebuilder/networking"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// Resourcebuilder is responsible for building native k8s resources
type ResourceBuilder struct {
	service  *v1.Service
	scheme   *runtime.Scheme
	provider networking.NetworkingProvider
}

func NewResourceBuilder(service *v1.Service, scheme *runtime.Scheme, provider networking.NetworkingProvider) *ResourceBuilder {
	return &ResourceBuilder{
		service:  service,
		scheme:   scheme,
		provider: provider,
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
