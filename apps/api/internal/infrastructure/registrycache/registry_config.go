package registrycache

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	RegistryDeploymentName = "docker-registry"
	RegistryConfigMapName  = "docker-registry-config"
	registryConfigVolume   = "registry-config"
	registryConfigDir      = "/etc/distribution"
	registryConfigKey      = "config.yml"
)

// Same as deploy/charts/charts/registry/templates/configmap.yaml. It has no blob descriptor cache,
// because garbage collection deletes blobs behind the cache and pushes then skip layers that are gone.
const registryConfig = `version: 0.1
log:
  fields:
    service: registry
storage:
  delete:
    enabled: true
  filesystem:
    rootdirectory: /var/lib/registry
  maintenance:
    uploadpurging:
      enabled: false
  tag:
    concurrencylimit: 8
http:
  addr: :5000
  headers:
    X-Content-Type-Options: [nosniff]
health:
  storagedriver:
    enabled: true
    interval: 10s
    threshold: 3
`

// MigrateRegistryConfig moves a registry running the image's default config onto ours, which restarts it once.
func (self *Manager) MigrateRegistryConfig(ctx context.Context) error {
	if err := self.ensureRegistryConfigMap(ctx); err != nil {
		return err
	}

	deployments := self.k8s.GetInternalClient().AppsV1().Deployments(self.namespace())
	deployment, err := deployments.Get(ctx, RegistryDeploymentName, metav1.GetOptions{})
	if err != nil {
		return err
	}
	if !mountRegistryConfig(&deployment.Spec.Template.Spec) {
		return nil
	}
	if _, err := deployments.Update(ctx, deployment, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("failed to mount registry config: %w", err)
	}
	return nil
}

func (self *Manager) ensureRegistryConfigMap(ctx context.Context) error {
	configMaps := self.k8s.GetInternalClient().CoreV1().ConfigMaps(self.namespace())
	_, err := configMaps.Get(ctx, RegistryConfigMapName, metav1.GetOptions{})
	if err == nil {
		return nil
	}
	if !apierrors.IsNotFound(err) {
		return err
	}

	configMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: RegistryConfigMapName, Namespace: self.namespace()},
		Data:       map[string]string{registryConfigKey: registryConfig},
	}
	if _, err := configMaps.Create(ctx, configMap, metav1.CreateOptions{}); err != nil {
		return fmt.Errorf("failed to create registry config: %w", err)
	}
	return nil
}

func mountRegistryConfig(spec *corev1.PodSpec) bool {
	for _, volume := range spec.Volumes {
		if volume.Name == registryConfigVolume {
			return false
		}
	}

	var container *corev1.Container
	for i := range spec.Containers {
		if spec.Containers[i].Name == RegistryContainerName {
			container = &spec.Containers[i]
		}
	}
	if container == nil {
		return false
	}

	spec.Volumes = append(spec.Volumes, corev1.Volume{
		Name: registryConfigVolume,
		VolumeSource: corev1.VolumeSource{
			ConfigMap: &corev1.ConfigMapVolumeSource{LocalObjectReference: corev1.LocalObjectReference{Name: RegistryConfigMapName}},
		},
	})
	container.VolumeMounts = append(container.VolumeMounts, corev1.VolumeMount{
		Name:      registryConfigVolume,
		MountPath: registryConfigDir,
		ReadOnly:  true,
	})
	return true
}
