package resourcebuilder

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func mountingService() *v1.Service {
	service := &v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "app-abc", Namespace: "team"}}
	service.Spec.KubernetesSecret = "app-abc"
	service.Spec.Config.VariableMounts = []v1.VariableMountSpec{
		{Name: "TOKEN", Path: "/secrets/token"},
		{Name: "LITERAL", Path: "/secrets/literal"},
	}
	service.Spec.EnvVars = []corev1.EnvVar{
		{Name: "TOKEN", Value: "rendered-token"},
		{Name: "UNMOUNTED", Value: "other"},
		{Name: "FROM_FIELD", ValueFrom: &corev1.EnvVarSource{FieldRef: &corev1.ObjectFieldSelector{FieldPath: "metadata.name"}}},
	}
	return service
}

func TestBuildVolumesMountsRenderedValues(t *testing.T) {
	volumes, mounts := NewResourceBuilder(mountingService(), nil, nil).buildVolumes()

	require.Len(t, volumes, 2)
	assert.Equal(t, "app-abc-mounts", volumes[0].Secret.SecretName, "a rendered variable mounts its rendered value")
	assert.Equal(t, []corev1.KeyToPath{{Key: "TOKEN", Path: "TOKEN"}}, volumes[0].Secret.Items)
	assert.Equal(t, "app-abc", volumes[1].Secret.SecretName, "a literal variable mounts from the service secret")
	assert.Equal(t, "/secrets/token", mounts[0].MountPath)
	assert.Equal(t, "TOKEN", mounts[0].SubPath)
}

func TestBuildRenderedMountsSecret(t *testing.T) {
	secret, err := NewResourceBuilder(mountingService(), nil, nil).BuildRenderedMountsSecret()

	require.NoError(t, err)
	assert.Equal(t, "app-abc-mounts", secret.Name)
	assert.Equal(t, "team", secret.Namespace)
	assert.Equal(t, map[string][]byte{"TOKEN": []byte("rendered-token")}, secret.Data, "only mounted variables with a rendered value")
}

func TestBuildRenderedMountsSecretNotNeeded(t *testing.T) {
	service := mountingService()
	service.Spec.EnvVars = []corev1.EnvVar{{Name: "UNMOUNTED", Value: "other"}}

	_, err := NewResourceBuilder(service, nil, nil).BuildRenderedMountsSecret()
	assert.ErrorIs(t, err, ErrRenderedMountsNotNeeded)

	volumes, _ := NewResourceBuilder(service, nil, nil).buildVolumes()
	for _, volume := range volumes {
		assert.Equal(t, "app-abc", volume.Secret.SecretName)
	}
}
