package controller

import (
	"context"
	"fmt"
	"maps"
	"slices"

	v1 "github.com/unbindapp/unbind-operator/api/v1"
	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/equality"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"
)

// No image has this, so the container fails to start once its image is pulled and
// nothing from the image ever runs
const prepullCommand = "/unbind-prepull"

const (
	prepullJobSuffix    = "-prepull"
	maxJobNameLength    = 63
	hostnameTopologyKey = "kubernetes.io/hostname"
)

func prepullJobName(serviceName string) string {
	return serviceName[:min(len(serviceName), maxJobNameLength-len(prepullJobSuffix))] + prepullJobSuffix
}

// prepullImages reports whether the rollout can go on. A rollout that stops the running
// replica first waits here until its images are on the server, so the pull is not
// downtime and an image that can't be pulled leaves the running replica alone.
func (r *ServiceReconciler) prepullImages(ctx context.Context, service *v1.Service, desired *appsv1.Deployment) (bool, error) {
	if desired.Spec.Strategy.Type != appsv1.RecreateDeploymentStrategyType {
		return true, nil
	}

	existing := &appsv1.Deployment{}
	err := r.Get(ctx, client.ObjectKeyFromObject(desired), existing)
	if errors.IsNotFound(err) {
		return true, nil
	}
	if err != nil {
		return false, fmt.Errorf("getting deployment %s: %w", desired.Name, err)
	}
	if !needsPrepull(existing, desired) {
		return true, nil
	}

	job := prepullJob(desired)
	hash := renderHash(job.Spec)
	existingJob := &batchv1.Job{}
	err = r.Get(ctx, client.ObjectKeyFromObject(job), existingJob)
	if errors.IsNotFound(err) {
		if err := controllerutil.SetControllerReference(service, job, r.Scheme); err != nil {
			return false, fmt.Errorf("setting controller reference: %w", err)
		}
		setRenderHash(job, hash)
		log.FromContext(ctx).Info("Pulling images ahead of the rollout", "job", job.Name)
		return false, r.Create(ctx, job)
	}
	if err != nil {
		return false, fmt.Errorf("getting job %s: %w", job.Name, err)
	}

	// Left from an earlier rollout, its removal brings the reconcile back
	if !renderHashMatches(existingJob, hash) {
		return false, r.deletePrepullJob(ctx, service)
	}
	return jobFinished(existingJob), nil
}

// Nothing is gained when no replica is serving or the replica is not replaced
func needsPrepull(existing, desired *appsv1.Deployment) bool {
	if existing.Status.ReadyReplicas == 0 {
		return false
	}
	return !equality.Semantic.DeepDerivative(desired.Spec.Template, existing.Spec.Template)
}

func prepullJob(desired *appsv1.Deployment) *batchv1.Job {
	template := desired.Spec.Template

	// Without the selector labels the pod is never taken for a replica of the deployment
	labels := maps.Clone(template.Labels)
	for key := range desired.Spec.Selector.MatchLabels {
		delete(labels, key)
	}
	labels[v1.PrepullLabel] = "true"

	var containers []corev1.Container
	pulled := map[string]bool{}
	for _, container := range slices.Concat(template.Spec.InitContainers, template.Spec.Containers) {
		if pulled[container.Image] {
			continue
		}
		pulled[container.Image] = true
		containers = append(containers, corev1.Container{
			Name:            fmt.Sprintf("image-%d", len(containers)),
			Image:           container.Image,
			ImagePullPolicy: container.ImagePullPolicy,
			Command:         []string{prepullCommand},
		})
	}

	return &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      prepullJobName(desired.Name),
			Namespace: desired.Namespace,
			Labels:    map[string]string{v1.PrepullLabel: "true"},
		},
		Spec: batchv1.JobSpec{
			BackoffLimit: ptr.To(int32(0)),
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: labels},
				Spec: corev1.PodSpec{
					RestartPolicy:                 corev1.RestartPolicyNever,
					AutomountServiceAccountToken:  ptr.To(false),
					TerminationGracePeriodSeconds: ptr.To(int64(0)),
					ImagePullSecrets:              template.Spec.ImagePullSecrets,
					Containers:                    containers,
					// The new replica most likely starts where the running one is
					Affinity: &corev1.Affinity{
						PodAffinity: &corev1.PodAffinity{
							PreferredDuringSchedulingIgnoredDuringExecution: []corev1.WeightedPodAffinityTerm{{
								Weight: 100,
								PodAffinityTerm: corev1.PodAffinityTerm{
									LabelSelector: desired.Spec.Selector,
									TopologyKey:   hostnameTopologyKey,
								},
							}},
						},
					},
				},
			},
		},
	}
}

func (r *ServiceReconciler) deletePrepullJob(ctx context.Context, service *v1.Service) error {
	job := &batchv1.Job{}
	err := r.Get(ctx, client.ObjectKey{Namespace: service.Namespace, Name: prepullJobName(service.Name)}, job)
	if errors.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("getting job %s: %w", prepullJobName(service.Name), err)
	}
	err = r.Delete(ctx, job, client.PropagationPolicy(metav1.DeletePropagationBackground))
	return client.IgnoreNotFound(err)
}
