package resourcebuilder

import (
	"errors"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var ErrCronJobNotNeeded = errors.New("cron job not needed")

const (
	// A run that could not start within this window is skipped, and the next tick starts fresh
	cronStartingDeadlineSeconds int64 = 300
	cronRunsKeptPerOutcome      int32 = 10
)

// BuildCronJob renders a scheduled service: the Deployment's pod, run once per tick and
// expected to exit. Nothing is exposed, so ports and probes are left out.
func (rb *ResourceBuilder) BuildCronJob() (*batchv1.CronJob, error) {
	config := rb.service.Spec.Config
	if config.Image == "" || config.CronSchedule == "" {
		return nil, ErrCronJobNotNeeded
	}

	volumes, volumeMounts := rb.buildVolumes()
	container := rb.buildMainContainer(volumeMounts)
	container.Ports = nil
	container.LivenessProbe = nil
	container.ReadinessProbe = nil
	container.StartupProbe = nil

	var timeZone *string
	if config.CronTimeZone != "" {
		timeZone = new(config.CronTimeZone)
	}

	return &batchv1.CronJob{
		ObjectMeta: rb.buildObjectMeta(),
		Spec: batchv1.CronJobSpec{
			Schedule:                   config.CronSchedule,
			TimeZone:                   timeZone,
			ConcurrencyPolicy:          batchv1.ForbidConcurrent,
			Suspend:                    new(config.Stopped),
			StartingDeadlineSeconds:    new(cronStartingDeadlineSeconds),
			SuccessfulJobsHistoryLimit: new(cronRunsKeptPerOutcome),
			FailedJobsHistoryLimit:     new(cronRunsKeptPerOutcome),
			JobTemplate: batchv1.JobTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: rb.getCommonLabels()},
				Spec: batchv1.JobSpec{
					BackoffLimit: new(int32(0)),
					Template: corev1.PodTemplateSpec{
						ObjectMeta: metav1.ObjectMeta{
							Labels:      rb.getCommonLabels(),
							Annotations: rb.buildPodAnnotations(),
						},
						Spec: corev1.PodSpec{
							RestartPolicy:    corev1.RestartPolicyNever,
							ImagePullSecrets: rb.buildImagePullSecrets(),
							InitContainers:   rb.buildInitContainers(container.Resources, volumeMounts),
							Containers:       []corev1.Container{container},
							Volumes:          volumes,
							SecurityContext:  rb.buildPodSecurityContext(),
						},
					},
				},
			},
		},
	}, nil
}
