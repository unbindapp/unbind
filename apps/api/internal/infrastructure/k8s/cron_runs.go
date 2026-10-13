package k8s

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/models"
	unbindv1 "github.com/unbindapp/unbind-operator/api/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
)

// The annotation kubectl puts on a Job created from a CronJob by hand
const manualRunAnnotation = "cronjob.kubernetes.io/instantiate"

const (
	manualRunNameSuffix = "-manual-"
	maxRunNameLength    = 63
)

var ErrCronRunInProgress = errors.New("a run is already in progress")

// ListCronRuns returns the runs the cluster still keeps for a scheduled service, newest first
func (k *KubeClient) ListCronRuns(ctx context.Context, namespace string, serviceID uuid.UUID, client kubernetes.Interface) ([]*models.CronRunResponse, error) {
	jobs, err := client.BatchV1().Jobs(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: "unbind-service=" + serviceID.String(),
	})
	if err != nil {
		return nil, fmt.Errorf("listing runs: %w", err)
	}

	runs := make([]*models.CronRunResponse, 0, len(jobs.Items))
	for i := range jobs.Items {
		job := &jobs.Items[i]
		if !isCronRun(job) {
			continue
		}
		run := cronRunFromJob(job)
		if run.Status == models.CronRunStatusFailed {
			run.FailureReason = k.runFailureReason(ctx, job, run.FailureReason, client)
		}
		runs = append(runs, run)
	}
	slices.SortFunc(runs, func(a, b *models.CronRunResponse) int {
		return b.CreatedAt.Compare(a.CreatedAt)
	})
	return runs, nil
}

// StartCronRun starts one run outside the schedule, the way kubectl create job --from does.
// The run is owned by the CronJob so it is kept with its history. The controller only
// tracks the jobs it started itself, so overlap is checked against the owned jobs here.
func (k *KubeClient) StartCronRun(ctx context.Context, namespace, cronJobName string, client kubernetes.Interface) (*models.CronRunResponse, error) {
	cronJob, err := client.BatchV1().CronJobs(namespace).Get(ctx, cronJobName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	active, err := hasActiveRun(ctx, cronJob, client)
	if err != nil {
		return nil, err
	}
	if active {
		return nil, ErrCronRunInProgress
	}

	annotations := maps.Clone(cronJob.Spec.JobTemplate.Annotations)
	if annotations == nil {
		annotations = map[string]string{}
	}
	annotations[manualRunAnnotation] = "manual"

	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:            manualRunName(cronJobName, time.Now()),
			Namespace:       namespace,
			Labels:          cronJob.Spec.JobTemplate.Labels,
			Annotations:     annotations,
			OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(cronJob, batchv1.SchemeGroupVersion.WithKind("CronJob"))},
		},
		Spec: cronJob.Spec.JobTemplate.Spec,
	}
	created, err := client.BatchV1().Jobs(namespace).Create(ctx, job, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("starting run: %w", err)
	}
	return cronRunFromJob(created), nil
}

// The job's own condition only says the backoff limit was hit; the exit code is on the pod
func (k *KubeClient) runFailureReason(ctx context.Context, job *batchv1.Job, fallback string, client kubernetes.Interface) string {
	pods, err := client.CoreV1().Pods(job.Namespace).List(ctx, metav1.ListOptions{LabelSelector: "batch.kubernetes.io/job-name=" + job.Name})
	if err != nil {
		return fallback
	}
	for _, pod := range pods.Items {
		for _, status := range pod.Status.ContainerStatuses {
			terminated := status.State.Terminated
			if terminated == nil || terminated.ExitCode == 0 {
				continue
			}
			if terminated.Reason == "OOMKilled" {
				return "Out of memory"
			}
			return fmt.Sprintf("Exited with code %d", terminated.ExitCode)
		}
	}
	return fallback
}

func hasActiveRun(ctx context.Context, cronJob *batchv1.CronJob, client kubernetes.Interface) (bool, error) {
	jobs, err := client.BatchV1().Jobs(cronJob.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: "unbind-service=" + cronJob.Spec.JobTemplate.Labels["unbind-service"],
	})
	if err != nil {
		return false, fmt.Errorf("listing runs: %w", err)
	}
	for i := range jobs.Items {
		job := &jobs.Items[i]
		if metav1.IsControlledBy(job, cronJob) && !JobFinished(job) {
			return true, nil
		}
	}
	return false, nil
}

// Two runs started in the same second must not collide, so the suffix is the nanosecond clock
func manualRunName(cronJobName string, now time.Time) string {
	suffix := manualRunNameSuffix + strconv.FormatInt(now.UnixNano(), 36)
	return cronJobName[:min(len(cronJobName), maxRunNameLength-len(suffix))] + suffix
}

// Prepull and build jobs share the service label, only a CronJob's own jobs are runs
func isCronRun(job *batchv1.Job) bool {
	if job.Labels[unbindv1.PrepullLabel] != "" {
		return false
	}
	owner := metav1.GetControllerOf(job)
	return owner != nil && owner.Kind == "CronJob"
}

func cronRunFromJob(job *batchv1.Job) *models.CronRunResponse {
	run := &models.CronRunResponse{
		Name:      job.Name,
		Status:    models.CronRunStatusRunning,
		Manual:    job.Annotations[manualRunAnnotation] == "manual",
		CreatedAt: job.CreationTimestamp.Time,
	}
	if deploymentID, err := uuid.Parse(job.Labels["unbind-deployment"]); err == nil {
		run.DeploymentID = &deploymentID
	}
	if job.Status.StartTime != nil {
		run.StartedAt = &job.Status.StartTime.Time
	}

	for _, condition := range job.Status.Conditions {
		if condition.Status != corev1.ConditionTrue {
			continue
		}
		switch condition.Type {
		case batchv1.JobComplete:
			run.Status = models.CronRunStatusSucceeded
			run.CompletedAt = &condition.LastTransitionTime.Time
			if job.Status.CompletionTime != nil {
				run.CompletedAt = &job.Status.CompletionTime.Time
			}
		case batchv1.JobFailed:
			run.Status = models.CronRunStatusFailed
			run.CompletedAt = &condition.LastTransitionTime.Time
			run.FailureReason = condition.Message
			if run.FailureReason == "" {
				run.FailureReason = condition.Reason
			}
		}
	}
	return run
}

const cronRunAlertedAnnotation = "unbind.app/run-failure-alerted"

// ListUnalertedFailedCronRuns finds failed runs in every namespace that no alert went out for yet
func (k *KubeClient) ListUnalertedFailedCronRuns(ctx context.Context, client kubernetes.Interface) ([]*batchv1.Job, error) {
	jobs, err := client.BatchV1().Jobs("").List(ctx, metav1.ListOptions{LabelSelector: "unbind-service"})
	if err != nil {
		return nil, fmt.Errorf("listing runs: %w", err)
	}

	var failed []*batchv1.Job
	for i := range jobs.Items {
		job := &jobs.Items[i]
		if !isCronRun(job) || job.Annotations[cronRunAlertedAnnotation] != "" {
			continue
		}
		if cronRunFromJob(job).Status != models.CronRunStatusFailed {
			continue
		}
		failed = append(failed, job)
	}
	return failed, nil
}

func (k *KubeClient) MarkCronRunAlerted(ctx context.Context, job *batchv1.Job, client kubernetes.Interface) error {
	patch := fmt.Sprintf(`{"metadata":{"annotations":{%q:"true"}}}`, cronRunAlertedAnnotation)
	_, err := client.BatchV1().Jobs(job.Namespace).Patch(ctx, job.Name, types.MergePatchType, []byte(patch), metav1.PatchOptions{})
	if err != nil {
		return fmt.Errorf("marking run %s alerted: %w", job.Name, err)
	}
	return nil
}
