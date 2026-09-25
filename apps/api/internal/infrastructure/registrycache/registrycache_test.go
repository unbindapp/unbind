package registrycache

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
)

func TestConvertCleanupContainerReplacesShellJob(t *testing.T) {
	container := &corev1.Container{
		Name:    CleanupContainerName,
		Image:   "ubuntu:24.04",
		Command: []string{"/bin/bash", "-c", "kubectl ..."},
		Env: []corev1.EnvVar{
			{Name: "REGISTRY_URL", Value: "http://docker-registry:5000"},
			{Name: ThresholdEnvVar, Value: "3Gi"},
		},
	}

	require.True(t, convertCleanupContainer(container, "ghcr.io/unbindapp/unbind:v1.2.3"))

	assert.Equal(t, "ghcr.io/unbindapp/unbind:v1.2.3", container.Image)
	assert.Equal(t, cleanupCommand, container.Command)
	require.Len(t, container.Env, 2)
	assert.Equal(t, "metadata.namespace", container.Env[0].ValueFrom.FieldRef.FieldPath)
	assert.Equal(t, corev1.EnvVar{Name: ThresholdEnvVar, Value: "3Gi"}, container.Env[1])
	assert.False(t, container.Resources.Limits.Memory().IsZero())
}

func TestConvertCleanupContainerLeavesCLIJobAlone(t *testing.T) {
	container := &corev1.Container{
		Image:   "ghcr.io/unbindapp/unbind:v0.1.40",
		Command: []string{"/app/cli", "registry:cleanup"},
	}

	assert.False(t, convertCleanupContainer(container, "ghcr.io/unbindapp/unbind:v1.2.3"))
	assert.Equal(t, "ghcr.io/unbindapp/unbind:v0.1.40", container.Image)
}

func TestMountRegistryConfigAddsVolumeOnce(t *testing.T) {
	spec := &corev1.PodSpec{
		Containers: []corev1.Container{{Name: RegistryContainerName}},
		Volumes:    []corev1.Volume{{Name: "registry-storage"}},
	}

	require.True(t, mountRegistryConfig(spec))
	require.False(t, mountRegistryConfig(spec))

	require.Len(t, spec.Volumes, 2)
	assert.Equal(t, RegistryConfigMapName, spec.Volumes[1].ConfigMap.Name)
	assert.Equal(t, []corev1.VolumeMount{{Name: registryConfigVolume, MountPath: registryConfigDir, ReadOnly: true}}, spec.Containers[0].VolumeMounts)
}

func TestMountRegistryConfigSkipsUnknownContainer(t *testing.T) {
	spec := &corev1.PodSpec{Containers: []corev1.Container{{Name: "other"}}}

	assert.False(t, mountRegistryConfig(spec))
	assert.Empty(t, spec.Volumes)
}

func TestGrantJobListAddsRuleOnce(t *testing.T) {
	role := &rbacv1.Role{Rules: []rbacv1.PolicyRule{{APIGroups: []string{""}, Resources: []string{"pods"}, Verbs: []string{"get", "list"}}}}

	require.True(t, grantJobList(role))
	require.False(t, grantJobList(role))

	require.Len(t, role.Rules, 2)
	assert.Equal(t, rbacv1.PolicyRule{APIGroups: []string{"batch"}, Resources: []string{"jobs"}, Verbs: []string{"list"}}, role.Rules[1])
}

func TestRegistryConfigMatchesChart(t *testing.T) {
	chart, err := os.ReadFile("../../../../../deploy/charts/charts/registry/templates/configmap.yaml")
	require.NoError(t, err)

	_, block, found := strings.Cut(string(chart), "  config.yml: |\n")
	require.True(t, found)
	var lines []string
	for line := range strings.SplitSeq(block, "\n") {
		if line != "" && !strings.HasPrefix(line, "    ") {
			break
		}
		lines = append(lines, strings.TrimPrefix(line, "    "))
	}

	assert.Equal(t, registryConfig, strings.Join(lines, "\n"))
}
