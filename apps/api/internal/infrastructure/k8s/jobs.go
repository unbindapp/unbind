package k8s

import (
	"context"
	"fmt"
	"time"

	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (self *KubeClient) CreateDeployment(ctx context.Context, deploymentID string, env map[string]string) (jobName string, err error) {
	// Build a unique job name
	jobName = fmt.Sprintf("%s-deployment-%d", deploymentID, time.Now().Unix())

	// Convert environment variables from map to slice
	var envVars []corev1.EnvVar
	for k, v := range env {
		envVars = append(envVars, corev1.EnvVar{Name: k, Value: v})
	}

	// Create a default set of annotations
	annotations := map[string]string{
		"deployment-triggered-by": "github-webhook",
		"trigger-timestamp":       time.Now().Format(time.RFC3339),
	}

	// Define the Job object
	// Define the Job object
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name: jobName,
			Labels: map[string]string{
				"unbind-deployment-job":   "true",
				"unbind-deployment-build": deploymentID,
				"job-name":                jobName,
			},
			Annotations: annotations,
		},
		Spec: batchv1.JobSpec{
			TTLSecondsAfterFinished: utils.ToPtr[int32](300),
			BackoffLimit:            utils.ToPtr[int32](0),
			Parallelism:             utils.ToPtr[int32](1),
			// Timeout
			ActiveDeadlineSeconds: utils.ToPtr[int64](1200),
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						"unbind-deployment-job":   "true",
						"unbind-deployment-build": deploymentID,
						"job-name":                jobName,
					},
				},
				Spec: corev1.PodSpec{
					ServiceAccountName: "builder-serviceaccount",
					RestartPolicy:      corev1.RestartPolicyNever,
					Containers: []corev1.Container{
						{
							Name:  "build-container",
							Image: self.config.GetBuildImage(),
							Command: []string{
								"sh",
								"-c",
								fmt.Sprintf(`# Check if buildkitd is ready, fail if not
if ! buildctl --addr %s debug workers >/dev/null 2>&1; then
	echo "Error: Cannot connect to BuildKit daemon at %s"
	exit 1
fi

# Run the builder with BuildKit
exec /app/builder`, self.config.GetBuildkitHost(), self.config.GetBuildkitHost()),
							},
							Env: append(envVars, []corev1.EnvVar{
								{
									Name:  "BUILDKIT_HOST",
									Value: self.config.GetBuildkitHost(),
								},
								{
									Name:  "POSTGRES_HOST",
									Value: self.config.GetPostgresHost(),
								},
								{
									Name:  "POSTGRES_PORT",
									Value: fmt.Sprintf("%d", self.config.GetPostgresPort()),
								},
								{
									Name:  "POSTGRES_USER",
									Value: self.config.GetPostgresUser(),
								},
								{
									Name:  "POSTGRES_PASSWORD",
									Value: self.config.GetPostgresPassword(),
								},
								{
									Name:  "POSTGRES_DB",
									Value: self.config.GetPostgresDB(),
								},
							}...),
						},
					},
				},
			},
		},
	}
	// Create the Job in Kubernetes
	_, err = self.clientset.BatchV1().Jobs(self.config.GetSystemNamespace()).Create(ctx, job, metav1.CreateOptions{})
	return jobName, err
}

// For canceling jobs.
func (self *KubeClient) CancelJobsByServiceID(ctx context.Context, serviceID string) error {
	jobList, err := self.clientset.BatchV1().Jobs(self.config.GetSystemNamespace()).List(ctx, metav1.ListOptions{
		// We use the "serviceID" label to select jobs.
		LabelSelector: fmt.Sprintf("serviceID=%s", serviceID),
	})
	if err != nil {
		return fmt.Errorf("failed to list jobs for service ID %s: %v", serviceID, err)
	}
	for _, job := range jobList.Items {
		if job.Status.Active > 0 {
			// Delete the job. Using foreground deletion ensures that the pods are cleaned up.
			deletePolicy := metav1.DeletePropagationForeground
			if err := self.clientset.BatchV1().Jobs(self.config.GetSystemNamespace()).Delete(ctx, job.Name, metav1.DeleteOptions{
				PropagationPolicy: &deletePolicy,
			}); err != nil {
				return fmt.Errorf("failed to delete job %s: %v", job.Name, err)
			}
			log.Infof("Canceled existing job %s for service %s\n", job.Name, serviceID)
		}
	}
	return nil
}

func (self *KubeClient) CountActiveDeploymentJobs(ctx context.Context) (int, error) {
	jobList, err := self.clientset.BatchV1().Jobs(self.config.GetSystemNamespace()).List(ctx, metav1.ListOptions{
		LabelSelector: "unbind-deployment-job=true",
	})
	if err != nil {
		return 0, fmt.Errorf("failed to list jobs: %v", err)
	}

	activeCount := 0
	for _, job := range jobList.Items {
		if job.Status.Active > 0 {
			activeCount++
		}
	}

	return activeCount, nil
}

// Get status of a kubernetes Job resource
type JobConditionType int

const (
	JobSucceeded JobConditionType = iota
	JobFailed
	JobRunning
	JobPending
)

func (js JobConditionType) String() string {
	return [...]string{"JobSucceeded", "JobFailed", "JobRunning", "JobPending"}[js]
}

// JobStatus represents the status of a job with additional details
type JobStatus struct {
	ConditionType JobConditionType // JobPending, JobRunning, JobSucceeded, JobFailed
	FailureReason string           // Reason for failure if ConditionType is JobFailed
	StartTime     time.Time        // When the job started running
	CompletedTime time.Time        // When the job completed successfully
	FailedTime    time.Time        // When the job failed
}

func (self *KubeClient) GetJobStatus(ctx context.Context, jobName string) (JobStatus, error) {
	// Get the job from Kubernetes API
	job, err := self.clientset.BatchV1().Jobs(self.config.GetSystemNamespace()).Get(ctx, jobName, metav1.GetOptions{})
	if err != nil {
		return JobStatus{}, fmt.Errorf("failed to get job %s: %v", jobName, err)
	}

	result := JobStatus{}

	// Determine status based on job conditions
	if job.Status.Succeeded > 0 {
		result.ConditionType = JobSucceeded
		// Add completion time if available
		if job.Status.CompletionTime != nil {
			result.CompletedTime = job.Status.CompletionTime.Time
		} else {
			// Use now as fallback
			log.Warnf("Job %s has no completion time, using current time as fallback", jobName)
			result.CompletedTime = time.Now()
		}
	} else if job.Status.Failed > 0 {
		result.ConditionType = JobFailed

		// Try to extract failure reason from conditions
		for _, condition := range job.Status.Conditions {
			if condition.Type == batchv1.JobFailed && condition.Status == corev1.ConditionTrue {
				result.FailureReason = condition.Reason + ": " + condition.Message
				// Set the time from the condition's last transition time
				if !condition.LastTransitionTime.IsZero() {
					result.FailedTime = condition.LastTransitionTime.Time
				} else {
					// Use now as fallback
					log.Warnf("Job %s has no last transition time, using current time as fallback", jobName)
					result.FailedTime = time.Now()
				}
				break
			}
		}

		// If no reason found in conditions, try to get it from the associated pods
		if result.FailureReason == "" {
			result.FailureReason = self.getJobPodsFailureReason(ctx, job.Name)

			// If no failed time set from conditions, use the job's start time
			// plus the active deadline if available, or current time as fallback
			if result.FailedTime.IsZero() {
				if job.Spec.ActiveDeadlineSeconds != nil && job.Status.StartTime != nil {
					deadline := time.Duration(*job.Spec.ActiveDeadlineSeconds) * time.Second
					result.FailedTime = job.Status.StartTime.Add(deadline)
				} else {
					// fallback to current time
					log.Warnf("Job %s has no failed time, using current time as fallback", jobName)
					result.FailedTime = time.Now()
				}
			}
		}
	} else if job.Status.Active > 0 {
		result.ConditionType = JobRunning
		// Add start time if available
		if job.Status.StartTime != nil {
			result.StartTime = job.Status.StartTime.Time
		} else {
			// Use now as fallback
			log.Warnf("Job %s has no start time, using current time as fallback", jobName)
			result.StartTime = time.Now()
		}
	} else {
		result.ConditionType = JobPending
	}

	return result, nil
}

// getJobPodsFailureReason attempts to get failure reasons from pods associated with the job
func (self *KubeClient) getJobPodsFailureReason(ctx context.Context, jobName string) string {
	// Get pods with the job-name label
	labelSelector := fmt.Sprintf("job-name=%s", jobName)
	pods, err := self.clientset.CoreV1().Pods(self.config.GetSystemNamespace()).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})

	if err != nil || len(pods.Items) == 0 {
		return "Unknown failure reason"
	}

	// Look for failed pods and extract their termination reason
	for _, pod := range pods.Items {
		for _, containerStatus := range pod.Status.ContainerStatuses {
			if containerStatus.State.Terminated != nil && containerStatus.State.Terminated.ExitCode != 0 {
				reason := containerStatus.State.Terminated.Reason
				message := containerStatus.State.Terminated.Message

				if message != "" {
					return fmt.Sprintf("%s: %s (Container: %s, Exit Code: %d)",
						reason, message, containerStatus.Name, containerStatus.State.Terminated.ExitCode)
				}

				return fmt.Sprintf("%s (Container: %s, Exit Code: %d)",
					reason, containerStatus.Name, containerStatus.State.Terminated.ExitCode)
			}
		}

		// If no terminated containers found, check pod's status
		if pod.Status.Phase == corev1.PodFailed {
			return fmt.Sprintf("Pod failed: %s", pod.Status.Reason)
		}
	}

	return "Unknown failure reason"
}
