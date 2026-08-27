package k8s

import (
	"context"
	"fmt"
	"strings"

	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
)

const updateManifestsKey = "manifests.yaml"

func updateJobName(version string) string {
	return "unbind-update-apply-" + strings.ReplaceAll(version, ".", "-")
}

// RunManifestApplyJob applies rendered release manifests through a job running as the
// elevated updater service account, and waits for it to finish.
func (self *KubeClient) RunManifestApplyJob(ctx context.Context, version, image string, manifests []byte) error {
	namespace := self.config.GetSystemNamespace()
	name := updateJobName(version)

	if err := self.deleteManifestApplyJob(ctx, namespace, name); err != nil {
		return err
	}
	defer func() {
		if err := self.deleteManifestApplyJob(context.WithoutCancel(ctx), namespace, name); err != nil {
			log.Warnf("Failed to clean up update job %s: %v", name, err)
		}
	}()

	configMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
		Data:       map[string]string{updateManifestsKey: string(manifests)},
	}
	if _, err := self.clientset.CoreV1().ConfigMaps(namespace).Create(ctx, configMap, metav1.CreateOptions{}); err != nil {
		return fmt.Errorf("failed to create update manifests configmap: %w", err)
	}

	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
		Spec: batchv1.JobSpec{
			BackoffLimit:            utils.ToPtr(int32(0)),
			ActiveDeadlineSeconds:   utils.ToPtr(int64(600)),
			TTLSecondsAfterFinished: utils.ToPtr(int32(300)),
			Template: corev1.PodTemplateSpec{
				Spec: corev1.PodSpec{
					ServiceAccountName: self.config.GetUpdaterServiceAccount(),
					RestartPolicy:      corev1.RestartPolicyNever,
					Containers: []corev1.Container{
						{
							Name:                     "apply-manifests",
							Image:                    image,
							Command:                  []string{"/app/cli", "update:apply-manifests", "--file", "/manifests/" + updateManifestsKey},
							Env:                      []corev1.EnvVar{{Name: "SYSTEM_NAMESPACE", Value: namespace}},
							TerminationMessagePolicy: corev1.TerminationMessageFallbackToLogsOnError,
							VolumeMounts:             []corev1.VolumeMount{{Name: "manifests", MountPath: "/manifests", ReadOnly: true}},
						},
					},
					Volumes: []corev1.Volume{
						{
							Name: "manifests",
							VolumeSource: corev1.VolumeSource{
								ConfigMap: &corev1.ConfigMapVolumeSource{
									LocalObjectReference: corev1.LocalObjectReference{Name: name},
								},
							},
						},
					},
				},
			},
		},
	}
	if _, err := self.clientset.BatchV1().Jobs(namespace).Create(ctx, job, metav1.CreateOptions{}); err != nil {
		return fmt.Errorf("failed to create update job: %w", err)
	}

	return self.waitForUpdateJob(ctx, name)
}

func (self *KubeClient) waitForUpdateJob(ctx context.Context, name string) error {
	return wait.PollUntilContextCancel(ctx, self.updateJobPollInterval, true, func(ctx context.Context) (bool, error) {
		status, err := self.GetJobStatus(ctx, name)
		if err != nil {
			return false, err
		}

		switch status.ConditionType {
		case JobSucceeded:
			return true, nil
		case JobFailed:
			// The job condition only says BackoffLimitExceeded; the applier's stderr
			// lives in the pod's termination message.
			failure := status.FailureReason
			if podFailure := self.getJobPodsFailureReason(ctx, name); podFailure != "Unknown failure reason" {
				failure = podFailure
			}
			return false, fmt.Errorf("update job %s failed: %s", name, failure)
		default:
			return false, nil
		}
	})
}

func (self *KubeClient) deleteManifestApplyJob(ctx context.Context, namespace, name string) error {
	propagation := metav1.DeletePropagationForeground
	err := self.clientset.BatchV1().Jobs(namespace).Delete(ctx, name, metav1.DeleteOptions{PropagationPolicy: &propagation})
	if err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to delete update job %s: %w", name, err)
	}
	if err == nil {
		if err := self.waitForUpdateJobDeletion(ctx, namespace, name); err != nil {
			return err
		}
	}

	err = self.clientset.CoreV1().ConfigMaps(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to delete update manifests configmap %s: %w", name, err)
	}
	return nil
}

func (self *KubeClient) waitForUpdateJobDeletion(ctx context.Context, namespace, name string) error {
	return wait.PollUntilContextCancel(ctx, self.updateJobPollInterval, true, func(ctx context.Context) (bool, error) {
		_, err := self.clientset.BatchV1().Jobs(namespace).Get(ctx, name, metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			return true, nil
		}
		return false, err
	})
}
