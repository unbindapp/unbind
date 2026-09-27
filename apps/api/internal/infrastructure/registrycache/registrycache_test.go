package registrycache

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/internal/models"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

func TestManualCleanupJob(t *testing.T) {
	cron := &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{Name: CleanupCronJobName, Namespace: "unbind-system", UID: "cron-uid"},
		Spec: batchv1.CronJobSpec{JobTemplate: batchv1.JobTemplateSpec{Spec: batchv1.JobSpec{
			BackoffLimit: new(int32(0)),
			Template: corev1.PodTemplateSpec{Spec: corev1.PodSpec{Containers: []corev1.Container{{
				Name:    CleanupContainerName,
				Command: cleanupCommand,
				Env:     []corev1.EnvVar{{Name: ThresholdEnvVar, Value: "16Gi"}},
			}}}},
		}}},
	}

	job := manualCleanupJob(cron)

	assert.Equal(t, "unbind-system", job.Namespace)
	assert.Equal(t, manualRunValue, job.Annotations[manualRunAnnotation])
	require.Len(t, job.OwnerReferences, 1)
	assert.Equal(t, "CronJob", job.OwnerReferences[0].Kind)
	assert.Equal(t, CleanupCronJobName, job.OwnerReferences[0].Name)
	assert.True(t, *job.OwnerReferences[0].Controller)
	assert.True(t, ownedByCleanupCron(job))

	container := job.Spec.Template.Spec.Containers[0]
	assert.Equal(t, []string{PruneAllFlag}, container.Args)
	assert.Equal(t, "16Gi", container.Env[0].Value)
	assert.Empty(t, cron.Spec.JobTemplate.Spec.Template.Spec.Containers[0].Args, "the schedule keeps pruning to the threshold")
}

func TestParseCleanupResult(t *testing.T) {
	result := ParseCleanupResult(`{"outcome":"cleaned","freed_bytes":1024,"deleted_images":3}`)
	require.NotNil(t, result)
	assert.Equal(t, models.RegistryCleanupCleaned, result.Outcome)
	assert.Equal(t, int64(1024), result.FreedBytes)
	assert.Equal(t, 3, result.DeletedImages)

	failed := ParseCleanupResult(`{"error":"no running registry pod found"}`)
	require.NotNil(t, failed)
	assert.Equal(t, "no running registry pod found", failed.Error)

	assert.Nil(t, ParseCleanupResult(""))
	assert.Nil(t, ParseCleanupResult("registry cleanup failed: boom"))
	assert.Nil(t, ParseCleanupResult(`{}`))
}

func TestCountImages(t *testing.T) {
	stats := countImages(map[string]int64{
		"team/app:abc123":          1,
		"team/app:def456":          2,
		"team/app:0f1e-buildcache": 3,
		"worker:v1":                4,
	})

	assert.Equal(t, 2, stats.RepositoryCount)
	assert.Equal(t, 3, stats.ImageCount)
}
