package resourcebuilder

import (
	"testing"

	"github.com/stretchr/testify/assert"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestBuildVolumesMountsRenderedValues(t *testing.T) {
	service := &v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "app"}}
	service.Spec.KubernetesSecret = "app"
	service.Spec.Config.VariableMounts = []v1.VariableMountSpec{
		{Name: "TOKEN", Path: "/secrets/token"},
		{Name: "LITERAL", Path: "/secrets/literal"},
	}
	service.Spec.EnvVars = []corev1.EnvVar{{Name: "TOKEN", Value: "rendered"}}

	volumes, _ := NewResourceBuilder(service, nil, nil).buildVolumes()

	assert.Equal(t, "app-mounts", volumes[0].Secret.SecretName)
	assert.Equal(t, "app", volumes[1].Secret.SecretName)
}
