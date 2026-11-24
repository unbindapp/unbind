package resourcebuilder

import (
	corev1 "k8s.io/api/core/v1"
)

func (rb *ResourceBuilder) BuildRenderedMountsSecret() *corev1.Secret {
	meta := rb.buildObjectMeta()
	meta.Name = rb.renderedMountsSecretName()
	return &corev1.Secret{ObjectMeta: meta, Type: corev1.SecretTypeOpaque, Data: rb.renderedMountValues()}
}

func (rb *ResourceBuilder) renderedMountsSecretName() string {
	return rb.service.Name + "-mounts"
}

func (rb *ResourceBuilder) renderedMountValues() map[string][]byte {
	rendered := make(map[string]string, len(rb.service.Spec.EnvVars))
	for _, env := range rb.service.Spec.EnvVars {
		rendered[env.Name] = env.Value
	}

	values := make(map[string][]byte)
	for _, vm := range rb.service.Spec.Config.VariableMounts {
		value, ok := rendered[vm.Name]
		if !ok {
			continue
		}
		values[vm.Name] = []byte(value)
	}
	return values
}
