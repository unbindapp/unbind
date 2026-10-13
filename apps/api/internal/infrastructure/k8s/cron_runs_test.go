package k8s

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/internal/models"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes/fake"
)

func runCronJob(serviceID, deploymentID uuid.UUID) *batchv1.CronJob {
	labels := map[string]string{"unbind-service": serviceID.String(), "unbind-deployment": deploymentID.String()}
	return &batchv1.CronJob{
		ObjectMeta: metav1.ObjectMeta{Name: "report", Namespace: "team", UID: types.UID("cron-uid"), Labels: labels},
		Spec: batchv1.CronJobSpec{
			Schedule: "0 * * * *",
			JobTemplate: batchv1.JobTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: labels},
				Spec: batchv1.JobSpec{Template: corev1.PodTemplateSpec{Spec: corev1.PodSpec{
					RestartPolicy: corev1.RestartPolicyNever,
					Containers:    []corev1.Container{{Name: "report", Image: "report:1"}},
				}}},
			},
		},
	}
}

func ownedRun(cronJob *batchv1.CronJob, name string, created time.Time, conditions ...batchv1.JobCondition) *batchv1.Job {
	return &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			Namespace:         cronJob.Namespace,
			Labels:            cronJob.Spec.JobTemplate.Labels,
			CreationTimestamp: metav1.NewTime(created),
			OwnerReferences:   []metav1.OwnerReference{*metav1.NewControllerRef(cronJob, batchv1.SchemeGroupVersion.WithKind("CronJob"))},
		},
		Status: batchv1.JobStatus{StartTime: new(metav1.NewTime(created.Add(time.Second))), Conditions: conditions},
	}
}

func TestListCronRuns(t *testing.T) {
	ctx := context.Background()
	serviceID, deploymentID := uuid.New(), uuid.New()
	cronJob := runCronJob(serviceID, deploymentID)
	now := time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC)

	succeeded := ownedRun(cronJob, "report-1", now.Add(-2*time.Hour), batchv1.JobCondition{
		Type: batchv1.JobComplete, Status: corev1.ConditionTrue, LastTransitionTime: metav1.NewTime(now.Add(-2*time.Hour + time.Minute)),
	})
	succeeded.Status.CompletionTime = new(metav1.NewTime(now.Add(-2*time.Hour + 2*time.Minute)))
	failed := ownedRun(cronJob, "report-2", now.Add(-time.Hour), batchv1.JobCondition{
		Type: batchv1.JobFailed, Status: corev1.ConditionTrue, Reason: "BackoffLimitExceeded", Message: "Job has reached the specified backoff limit",
		LastTransitionTime: metav1.NewTime(now.Add(-time.Hour + time.Minute)),
	})
	running := ownedRun(cronJob, "report-manual-3", now)
	running.Annotations = map[string]string{manualRunAnnotation: "manual"}
	prepull := &batchv1.Job{ObjectMeta: metav1.ObjectMeta{Name: "report-prepull", Namespace: "team", Labels: map[string]string{
		"unbind-service": serviceID.String(), "unbind-prepull": "true",
	}}}
	otherService := &batchv1.Job{ObjectMeta: metav1.ObjectMeta{Name: "other", Namespace: "team", Labels: map[string]string{"unbind-service": uuid.NewString()}}}

	failedPod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "report-2-abcde", Namespace: "team", Labels: map[string]string{"batch.kubernetes.io/job-name": "report-2"}},
		Status: corev1.PodStatus{ContainerStatuses: []corev1.ContainerStatus{{
			State: corev1.ContainerState{Terminated: &corev1.ContainerStateTerminated{ExitCode: 3, Reason: "Error"}},
		}}},
	}

	client := fake.NewClientset(cronJob, succeeded, failed, running, prepull, otherService, failedPod)
	runs, err := (&KubeClient{}).ListCronRuns(ctx, "team", serviceID, client)
	require.NoError(t, err)
	require.Len(t, runs, 3, "prepull jobs and other services are not runs")

	assert.Equal(t, "report-manual-3", runs[0].Name, "newest first")
	assert.Equal(t, models.CronRunStatusRunning, runs[0].Status)
	assert.True(t, runs[0].Manual)
	assert.Nil(t, runs[0].CompletedAt)

	assert.Equal(t, models.CronRunStatusFailed, runs[1].Status)
	assert.Equal(t, "Exited with code 3", runs[1].FailureReason, "the pod's exit code beats the job's generic message")
	assert.Equal(t, now.Add(-time.Hour+time.Minute), *runs[1].CompletedAt)
	assert.False(t, runs[1].Manual)

	assert.Equal(t, models.CronRunStatusSucceeded, runs[2].Status)
	assert.Equal(t, now.Add(-2*time.Hour+2*time.Minute), *runs[2].CompletedAt, "the job's completion time wins over the condition")
	assert.Equal(t, deploymentID, *runs[2].DeploymentID)
	assert.Equal(t, now.Add(-2*time.Hour+time.Second), *runs[2].StartedAt)
}

func TestStartCronRun(t *testing.T) {
	ctx := context.Background()
	serviceID, deploymentID := uuid.New(), uuid.New()
	cronJob := runCronJob(serviceID, deploymentID)
	client := fake.NewClientset(cronJob)

	run, err := (&KubeClient{}).StartCronRun(ctx, "team", "report", client)
	require.NoError(t, err)
	assert.True(t, run.Manual)
	assert.Equal(t, models.CronRunStatusRunning, run.Status)

	job, err := client.BatchV1().Jobs("team").Get(ctx, run.Name, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, "report:1", job.Spec.Template.Spec.Containers[0].Image, "the run uses the schedule's pod")
	assert.Equal(t, serviceID.String(), job.Labels["unbind-service"], "found like any other run")
	assert.True(t, metav1.IsControlledBy(job, cronJob), "the cron job keeps its history and counts it as active")

	_, err = (&KubeClient{}).StartCronRun(ctx, "team", "report", client)
	assert.ErrorIs(t, err, ErrCronRunInProgress, "the manual run is still going, runs don't overlap")

	job.Status.Conditions = []batchv1.JobCondition{{Type: batchv1.JobComplete, Status: corev1.ConditionTrue}}
	_, err = client.BatchV1().Jobs("team").UpdateStatus(ctx, job, metav1.UpdateOptions{})
	require.NoError(t, err)
	_, err = (&KubeClient{}).StartCronRun(ctx, "team", "report", client)
	assert.NoError(t, err, "a finished run frees the schedule")
}

func TestManualRunNameFitsAJobName(t *testing.T) {
	long := "a-very-long-service-name-that-goes-on-and-on-past-the-limit-abcdef"
	now := time.Unix(1760371200, 123)
	name := manualRunName(long, now)
	assert.LessOrEqual(t, len(name), maxRunNameLength)
	assert.Contains(t, name, "-manual-")
	assert.Regexp(t, `^report-manual-[0-9a-z]+$`, manualRunName("report", now))
	assert.NotEqual(t, manualRunName("report", now), manualRunName("report", now.Add(time.Nanosecond)), "runs started close together get their own names")
}

func TestListUnalertedFailedCronRuns(t *testing.T) {
	ctx := context.Background()
	cronJob := runCronJob(uuid.New(), uuid.New())
	now := time.Now()
	failed := ownedRun(cronJob, "report-failed", now, batchv1.JobCondition{Type: batchv1.JobFailed, Status: corev1.ConditionTrue, Message: "exit 1"})
	alerted := ownedRun(cronJob, "report-alerted", now, batchv1.JobCondition{Type: batchv1.JobFailed, Status: corev1.ConditionTrue})
	alerted.Annotations = map[string]string{cronRunAlertedAnnotation: "true"}
	succeeded := ownedRun(cronJob, "report-ok", now, batchv1.JobCondition{Type: batchv1.JobComplete, Status: corev1.ConditionTrue})
	running := ownedRun(cronJob, "report-running", now)

	client := fake.NewClientset(cronJob, failed, alerted, succeeded, running)
	kube := &KubeClient{}

	jobs, err := kube.ListUnalertedFailedCronRuns(ctx, client)
	require.NoError(t, err)
	require.Len(t, jobs, 1, "only failed runs nobody was told about")
	assert.Equal(t, "report-failed", jobs[0].Name)

	require.NoError(t, kube.MarkCronRunAlerted(ctx, jobs[0], client))
	jobs, err = kube.ListUnalertedFailedCronRuns(ctx, client)
	require.NoError(t, err)
	assert.Empty(t, jobs, "an alert goes out once")
}
