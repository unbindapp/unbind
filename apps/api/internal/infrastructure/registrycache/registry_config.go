package registrycache

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	RegistryDeploymentName = "docker-registry"
	RegistryConfigMapName  = "docker-registry-config"
	RegistryAuthSecretName = "registry-basic-auth"
	registryConfigVolume   = "registry-config"
	registryConfigDir      = "/etc/distribution"
	registryConfigKey      = "config.yml"
	registryAuthVolume     = "registry-auth"
	registryAuthDir        = "/etc/registry-auth"
	registryAuthKey        = "auth"
	restartAnnotation      = "unbind.app/restarted-at"
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
auth:
  htpasswd:
    realm: unbind
    path: /etc/registry-auth/auth
health:
  storagedriver:
    enabled: true
    interval: 10s
    threshold: 3
`

// MigrateRegistryConfig moves a registry running an older config onto ours, which restarts it once.
// The htpasswd file is kept in step with the credentials the API pushes and pulls with.
func (self *Manager) MigrateRegistryConfig(ctx context.Context) error {
	if err := self.ensureRegistryAuthSecret(ctx); err != nil {
		return err
	}
	configChanged, err := self.ensureRegistryConfigMap(ctx)
	if err != nil {
		return err
	}

	deployments := self.k8s.GetInternalClient().AppsV1().Deployments(self.namespace())
	deployment, err := deployments.Get(ctx, RegistryDeploymentName, metav1.GetOptions{})
	if err != nil {
		return err
	}
	changed := mountRegistryVolumes(&deployment.Spec.Template.Spec)
	if configChanged && !changed {
		restartPods(&deployment.Spec.Template, time.Now())
		changed = true
	}
	if !changed {
		return nil
	}
	if _, err := deployments.Update(ctx, deployment, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("failed to update registry deployment: %w", err)
	}
	return nil
}

func (self *Manager) ensureRegistryConfigMap(ctx context.Context) (bool, error) {
	configMaps := self.k8s.GetInternalClient().CoreV1().ConfigMaps(self.namespace())
	configMap, err := configMaps.Get(ctx, RegistryConfigMapName, metav1.GetOptions{})
	if err != nil && !apierrors.IsNotFound(err) {
		return false, err
	}
	if apierrors.IsNotFound(err) {
		configMap = &corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{Name: RegistryConfigMapName, Namespace: self.namespace()},
			Data:       map[string]string{registryConfigKey: registryConfig},
		}
		if _, err := configMaps.Create(ctx, configMap, metav1.CreateOptions{}); err != nil {
			return false, fmt.Errorf("failed to create registry config: %w", err)
		}
		return true, nil
	}
	if configMap.Data[registryConfigKey] == registryConfig {
		return false, nil
	}
	configMap.Data = map[string]string{registryConfigKey: registryConfig}
	if _, err := configMaps.Update(ctx, configMap, metav1.UpdateOptions{}); err != nil {
		return false, fmt.Errorf("failed to update registry config: %w", err)
	}
	return true, nil
}

func (self *Manager) ensureRegistryAuthSecret(ctx context.Context) error {
	username, password := self.cfg.BootstrapContainerRegistryUser, self.cfg.BootstrapContainerRegistryPassword
	if username == "" || password == "" {
		return fmt.Errorf("registry credentials are not configured")
	}

	secrets := self.k8s.GetInternalClient().CoreV1().Secrets(self.namespace())
	secret, err := secrets.Get(ctx, RegistryAuthSecretName, metav1.GetOptions{})
	if err != nil && !apierrors.IsNotFound(err) {
		return err
	}
	if err == nil && htpasswdMatches(secret.Data[registryAuthKey], username, password) {
		return nil
	}

	entry, err := htpasswdEntry(username, password)
	if err != nil {
		return err
	}
	if apierrors.IsNotFound(err) {
		secret = &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{Name: RegistryAuthSecretName, Namespace: self.namespace()},
			Data:       map[string][]byte{registryAuthKey: entry},
		}
		if _, err := secrets.Create(ctx, secret, metav1.CreateOptions{}); err != nil {
			return fmt.Errorf("failed to create registry auth secret: %w", err)
		}
		return nil
	}
	secret.Data = map[string][]byte{registryAuthKey: entry}
	if _, err := secrets.Update(ctx, secret, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("failed to update registry auth secret: %w", err)
	}
	return nil
}

func htpasswdEntry(username, password string) ([]byte, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	return []byte(username + ":" + string(hash) + "\n"), nil
}

func htpasswdMatches(file []byte, username, password string) bool {
	for line := range bytes.Lines(file) {
		user, hash, ok := strings.Cut(strings.TrimSpace(string(line)), ":")
		if !ok || user != username {
			continue
		}
		return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
	}
	return false
}

// mountRegistryVolumes adds the config and htpasswd mounts and reports whether the pod spec changed.
func mountRegistryVolumes(spec *corev1.PodSpec) bool {
	config := mountRegistryVolume(spec, corev1.Volume{
		Name:         registryConfigVolume,
		VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{LocalObjectReference: corev1.LocalObjectReference{Name: RegistryConfigMapName}}},
	}, registryConfigDir)
	auth := mountRegistryVolume(spec, corev1.Volume{
		Name:         registryAuthVolume,
		VolumeSource: corev1.VolumeSource{Secret: &corev1.SecretVolumeSource{SecretName: RegistryAuthSecretName}},
	}, registryAuthDir)
	return config || auth
}

// restartPods rolls the deployment the way kubectl rollout restart does. The registry reads its
// config at startup only.
func restartPods(template *corev1.PodTemplateSpec, now time.Time) {
	if template.Annotations == nil {
		template.Annotations = map[string]string{}
	}
	template.Annotations[restartAnnotation] = now.UTC().Format(time.RFC3339)
}

func mountRegistryVolume(spec *corev1.PodSpec, volume corev1.Volume, mountPath string) bool {
	for _, existing := range spec.Volumes {
		if existing.Name == volume.Name {
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

	spec.Volumes = append(spec.Volumes, volume)
	container.VolumeMounts = append(container.VolumeMounts, corev1.VolumeMount{
		Name:      volume.Name,
		MountPath: mountPath,
		ReadOnly:  true,
	})
	return true
}
