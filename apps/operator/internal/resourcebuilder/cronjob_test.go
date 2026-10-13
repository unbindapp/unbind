package resourcebuilder

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "github.com/unbindapp/unbind-operator/api/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
)

func scheduledService() *v1.Service {
	service := &v1.Service{}
	service.Name = "report"
	service.Namespace = "team"
	service.Spec.ServiceRef = "service-id"
	service.Spec.DeploymentRef = "deployment-id"
	service.Spec.Config.Image = "report:1"
	service.Spec.Config.CronSchedule = "*/10 * * * *"
	service.Spec.Config.Ports = []v1.PortSpec{{Port: 8080}}
	service.Spec.Config.HealthCheck = &v1.HealthCheckSpec{Type: "http", Path: "/health"}
	return service
}

func TestBuildCronJob(t *testing.T) {
	service := scheduledService()
	cronJob, err := NewResourceBuilder(service, nil, nil).BuildCronJob()
	require.NoError(t, err)

	assert.Equal(t, "report", cronJob.Name)
	assert.Equal(t, "*/10 * * * *", cronJob.Spec.Schedule)
	assert.Nil(t, cronJob.Spec.TimeZone, "UTC when no zone is set")
	assert.Equal(t, batchv1.ForbidConcurrent, cronJob.Spec.ConcurrencyPolicy, "a run that outlasts the next tick skips it")
	assert.False(t, *cronJob.Spec.Suspend)
	assert.Equal(t, int32(0), *cronJob.Spec.JobTemplate.Spec.BackoffLimit, "a failed run is not retried, the schedule is the retry")

	pod := cronJob.Spec.JobTemplate.Spec.Template
	assert.Equal(t, corev1.RestartPolicyNever, pod.Spec.RestartPolicy)
	assert.Equal(t, "service-id", pod.Labels["unbind-service"], "runs are found by the same labels as replicas")
	assert.Equal(t, "deployment-id", pod.Labels["unbind-deployment"])
	assert.Equal(t, pod.Labels, cronJob.Spec.JobTemplate.Labels)
	container := pod.Spec.Containers[0]
	assert.Equal(t, "report:1", container.Image)
	assert.Empty(t, container.Ports, "nothing is exposed")
	assert.Nil(t, container.ReadinessProbe, "a run has nothing to probe")
	assert.Nil(t, container.LivenessProbe)
	assert.Nil(t, container.StartupProbe)
}

func TestBuildCronJobTimeZoneAndStop(t *testing.T) {
	service := scheduledService()
	service.Spec.Config.CronTimeZone = "Europe/Berlin"
	service.Spec.Config.Stopped = true

	cronJob, err := NewResourceBuilder(service, nil, nil).BuildCronJob()
	require.NoError(t, err)
	assert.Equal(t, "Europe/Berlin", *cronJob.Spec.TimeZone)
	assert.True(t, *cronJob.Spec.Suspend, "a stopped schedule keeps its history and skips its ticks")
}

func TestBuildCronJobNotNeeded(t *testing.T) {
	service := scheduledService()
	service.Spec.Config.CronSchedule = ""
	_, err := NewResourceBuilder(service, nil, nil).BuildCronJob()
	assert.ErrorIs(t, err, ErrCronJobNotNeeded)

	service = scheduledService()
	service.Spec.Config.Image = ""
	_, err = NewResourceBuilder(service, nil, nil).BuildCronJob()
	assert.ErrorIs(t, err, ErrCronJobNotNeeded, "nothing to run before the first build")
}
