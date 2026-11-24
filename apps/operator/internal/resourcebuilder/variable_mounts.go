package resourcebuilder

import (
	"errors"

	corev1 "k8s.io/api/core/v1"
)

var ErrRenderedMountsNotNeeded = errors.New("no mounted variable has a rendered value")

func (rb *ResourceBuilder) RenderedMountsSecretName() string {
	return rb.service.Name + "-mounts"
}

// BuildRenderedMountsSecret holds the rendered values of mounted variables, since the
// service secret keeps their references as written
func (rb *ResourceBuilder) BuildRenderedMountsSecret() (*corev1.Secret, error) {
	rendered := rb.renderedMountValues()
	if len(rendered) == 0 {
		return nil, ErrRenderedMountsNotNeeded
	}

	meta := rb.buildObjectMeta()
	meta.Name = rb.RenderedMountsSecretName()
	return &corev1.Secret{
		ObjectMeta: meta,
		Type:       corev1.SecretTypeOpaque,
		Data:       rendered,
	}, nil
}

func (rb *ResourceBuilder) renderedMountValues() map[string][]byte {
	mounted := make(map[string]struct{}, len(rb.service.Spec.Config.VariableMounts))
	for _, vm := range rb.service.Spec.Config.VariableMounts {
		mounted[vm.Name] = struct{}{}
	}

	values := make(map[string][]byte)
	for _, env := range rb.service.Spec.EnvVars {
		if env.ValueFrom != nil {
			continue
		}
		if _, ok := mounted[env.Name]; !ok {
			continue
		}
		values[env.Name] = []byte(env.Value)
	}
	return values
}
