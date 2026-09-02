package registrycache

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
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

	require.True(t, convertCleanupContainer(container, "ghcr.io/unbindapp/unbind:v0.1.39"))

	assert.Equal(t, "ghcr.io/unbindapp/unbind:v0.1.39", container.Image)
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

	assert.False(t, convertCleanupContainer(container, "ghcr.io/unbindapp/unbind:v0.1.39"))
	assert.Equal(t, "ghcr.io/unbindapp/unbind:v0.1.40", container.Image)
}
