package k8s

import (
	"context"
	"fmt"
	"slices"
	"strings"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	AppImageRepository      = "ghcr.io/unbindapp/unbind"
	OperatorImageRepository = "ghcr.io/unbindapp/unbind-operator"
)

var versionedImageRepositories = []string{AppImageRepository, OperatorImageRepository}

func versionedImage(image, version string) (string, bool) {
	for _, repository := range versionedImageRepositories {
		if strings.HasPrefix(image, repository+":") {
			return repository + ":" + version, true
		}
	}
	return "", false
}

func usesImageRepository(deployment *appsv1.Deployment, repository string) bool {
	return slices.ContainsFunc(deployment.Spec.Template.Spec.Containers, func(container corev1.Container) bool {
		return strings.HasPrefix(container.Image, repository+":")
	})
}

// UpdateDeploymentImages retags every unbind image in the system namespace; the app deployment (which runs this API) rolls last.
func (k *KubeClient) UpdateDeploymentImages(ctx context.Context, newVersion string) error {
	deployments, err := k.clientset.AppsV1().Deployments(k.config.GetSystemNamespace()).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list deployments: %w", err)
	}

	var appDeployments []*appsv1.Deployment
	for i := range deployments.Items {
		deployment := &deployments.Items[i]
		if usesImageRepository(deployment, AppImageRepository) {
			appDeployments = append(appDeployments, deployment)
			continue
		}
		if err := k.retagDeployment(ctx, deployment, newVersion); err != nil {
			return err
		}
	}

	for _, deployment := range appDeployments {
		if err := k.retagDeployment(ctx, deployment, newVersion); err != nil {
			return err
		}
	}

	return nil
}

func (k *KubeClient) retagDeployment(ctx context.Context, deployment *appsv1.Deployment, version string) error {
	containers := deployment.Spec.Template.Spec.Containers
	updated := false
	for i := range containers {
		image, ok := versionedImage(containers[i].Image, version)
		if !ok {
			continue
		}
		containers[i].Image = image
		updated = true
	}
	if !updated {
		return nil
	}

	if _, err := k.clientset.AppsV1().Deployments(deployment.Namespace).Update(ctx, deployment, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("failed to update deployment %s: %w", deployment.Name, err)
	}
	return nil
}

// CheckDeploymentsReady reports whether every deployment using an unbind image serves only ready pods on the given version.
func (k *KubeClient) CheckDeploymentsReady(ctx context.Context, version string) (bool, error) {
	deployments, err := k.clientset.AppsV1().Deployments(k.config.GetSystemNamespace()).List(ctx, metav1.ListOptions{})
	if err != nil {
		return false, fmt.Errorf("failed to list deployments: %w", err)
	}

	found := false
	for i := range deployments.Items {
		deployment := &deployments.Items[i]
		expected := expectedImages(deployment.Spec.Template.Spec.Containers, version)
		if len(expected) == 0 {
			continue
		}
		found = true

		pods, err := k.clientset.CoreV1().Pods(deployment.Namespace).List(ctx, metav1.ListOptions{
			LabelSelector: metav1.FormatLabelSelector(metav1.SetAsLabelSelector(deployment.Spec.Selector.MatchLabels)),
		})
		if err != nil {
			return false, fmt.Errorf("failed to list pods for deployment %s: %w", deployment.Name, err)
		}
		if !podsReadyOnVersion(pods.Items, expected, version) {
			return false, nil
		}
	}

	if !found {
		return false, fmt.Errorf("no deployments with unbind images found")
	}
	return true, nil
}

func expectedImages(containers []corev1.Container, version string) []string {
	var images []string
	for _, container := range containers {
		if image, ok := versionedImage(container.Image, version); ok {
			images = append(images, image)
		}
	}
	return images
}

func podsReadyOnVersion(pods []corev1.Pod, expected []string, version string) bool {
	for _, image := range expected {
		ready := slices.ContainsFunc(pods, func(pod corev1.Pod) bool {
			if pod.DeletionTimestamp != nil || !podIsReady(pod) {
				return false
			}
			return slices.ContainsFunc(pod.Spec.Containers, func(container corev1.Container) bool {
				return container.Image == image
			})
		})
		if !ready {
			return false
		}
	}

	// Old-version pods may still be serving traffic until the rollout replaces them.
	for _, pod := range pods {
		if pod.DeletionTimestamp != nil {
			continue
		}
		for _, container := range pod.Spec.Containers {
			if updated, ok := versionedImage(container.Image, version); ok && container.Image != updated {
				return false
			}
		}
	}
	return true
}

func podIsReady(pod corev1.Pod) bool {
	if pod.Status.Phase != corev1.PodRunning {
		return false
	}
	return slices.ContainsFunc(pod.Status.Conditions, func(condition corev1.PodCondition) bool {
		return condition.Type == corev1.PodReady && condition.Status == corev1.ConditionTrue
	})
}
