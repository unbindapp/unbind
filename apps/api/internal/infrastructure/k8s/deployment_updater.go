package k8s

import (
	"context"
	"fmt"
	"strings"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// UpdateDeploymentImages updates container images in deployments based on the new version
func (k *KubeClient) UpdateDeploymentImages(ctx context.Context, newVersion string) error {
	// Get all deployments in the system namespace
	deployments, err := k.clientset.AppsV1().Deployments(k.config.GetSystemNamespace()).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list deployments: %w", err)
	}

	// Map of image prefixes to their new versions
	imageUpdates := map[string]string{
		"ghcr.io/unbindapp/unbind-ui":       fmt.Sprintf("ghcr.io/unbindapp/unbind-ui:%s", newVersion),
		"ghcr.io/unbindapp/unbind-operator": fmt.Sprintf("ghcr.io/unbindapp/unbind-operator:%s", newVersion),
		"ghcr.io/unbindapp/unbind-api":      fmt.Sprintf("ghcr.io/unbindapp/unbind-api:%s", newVersion),
	}

	// First update all non-api deployments
	for _, deployment := range deployments.Items {
		// Skip if this is the API deployment
		if strings.Contains(deployment.Name, "api") {
			continue
		}

		updated := false
		for i, container := range deployment.Spec.Template.Spec.Containers {
			for prefix, newImage := range imageUpdates {
				if strings.HasPrefix(container.Image, prefix+":") {
					deployment.Spec.Template.Spec.Containers[i].Image = newImage
					updated = true
				}
			}
		}

		if updated {
			// Update the deployment
			_, err := k.clientset.AppsV1().Deployments(k.config.GetSystemNamespace()).Update(ctx, &deployment, metav1.UpdateOptions{})
			if err != nil {
				return fmt.Errorf("failed to update deployment %s: %w", deployment.Name, err)
			}
		}
	}

	// Then update the API deployment
	for _, deployment := range deployments.Items {
		// Only process API deployment
		if !strings.Contains(deployment.Name, "api") {
			continue
		}

		updated := false
		for i, container := range deployment.Spec.Template.Spec.Containers {
			for prefix, newImage := range imageUpdates {
				if strings.HasPrefix(container.Image, prefix+":") {
					deployment.Spec.Template.Spec.Containers[i].Image = newImage
					updated = true
				}
			}
		}

		if updated {
			// Update the deployment
			_, err := k.clientset.AppsV1().Deployments(k.config.GetSystemNamespace()).Update(ctx, &deployment, metav1.UpdateOptions{})
			if err != nil {
				return fmt.Errorf("failed to update deployment %s: %w", deployment.Name, err)
			}
		}
	}

	return nil
}

// CheckDeploymentsReady checks if all deployments with unbind images have at least one pod running with the specified version
func (k *KubeClient) CheckDeploymentsReady(ctx context.Context, version string) (bool, error) {
	// Get all deployments in the system namespace
	deployments, err := k.clientset.AppsV1().Deployments(k.config.GetSystemNamespace()).List(ctx, metav1.ListOptions{})
	if err != nil {
		return false, fmt.Errorf("failed to list deployments: %w", err)
	}

	// Define the expected image base and version format
	unbindImageBase := "ghcr.io/unbindapp/"
	foundUnbindDeployments := false

	// Expected images for each component with version
	expectedImages := map[string]string{
		"ghcr.io/unbindapp/unbind-ui":       fmt.Sprintf("ghcr.io/unbindapp/unbind-ui:%s", version),
		"ghcr.io/unbindapp/unbind-operator": fmt.Sprintf("ghcr.io/unbindapp/unbind-operator:%s", version),
		"ghcr.io/unbindapp/unbind-api":      fmt.Sprintf("ghcr.io/unbindapp/unbind-api:%s", version),
	}

	// Check each deployment
	for _, deployment := range deployments.Items {
		deploymentHasUnbindImage := false
		requiredImages := make(map[string]bool)

		// Check if this deployment has any unbind images
		for _, container := range deployment.Spec.Template.Spec.Containers {
			if strings.HasPrefix(container.Image, unbindImageBase) {
				deploymentHasUnbindImage = true

				// Extract the base image name (before the tag)
				baseImage := container.Image
				if tagIndex := strings.LastIndex(baseImage, ":"); tagIndex > 0 {
					baseImage = baseImage[:tagIndex]
				}

				// Mark which images we need to find in running pods
				if _, exists := expectedImages[baseImage]; exists {
					requiredImages[baseImage] = false
				}
			}
		}

		// Skip if not an unbind deployment
		if !deploymentHasUnbindImage {
			continue
		}

		foundUnbindDeployments = true

		// Get the pods for this deployment
		pods, err := k.clientset.CoreV1().Pods(k.config.GetSystemNamespace()).List(ctx, metav1.ListOptions{
			LabelSelector: metav1.FormatLabelSelector(metav1.SetAsLabelSelector(deployment.Spec.Selector.MatchLabels)),
		})
		if err != nil {
			return false, fmt.Errorf("failed to list pods for deployment %s: %w", deployment.Name, err)
		}

		// Check if at least one pod is running with the correct version for each image
		for _, pod := range pods.Items {
			// Skip pods that aren't running
			if pod.Status.Phase != corev1.PodRunning {
				continue
			}

			// Check each container in the pod
			for _, container := range pod.Spec.Containers {
				// Only check unbind containers
				if strings.HasPrefix(container.Image, unbindImageBase) {
					// Extract the base image name
					baseImage := container.Image
					if tagIndex := strings.LastIndex(baseImage, ":"); tagIndex > 0 {
						baseImage = baseImage[:tagIndex]
					}

					// Check if this container has the correct version
					if expectedImage, exists := expectedImages[baseImage]; exists {
						if container.Image == expectedImage {
							requiredImages[baseImage] = true
						}
					}
				}
			}
		}

		// Check if we found at least one running pod with the correct version for each required image
		for _, found := range requiredImages {
			if !found {
				return false, nil
			}
		}
	}

	// If we found no unbind deployments, that's an error
	if !foundUnbindDeployments {
		return false, fmt.Errorf("no deployments with unbind images found")
	}

	// All unbind deployments have at least one pod running with the correct version
	return true, nil
}
