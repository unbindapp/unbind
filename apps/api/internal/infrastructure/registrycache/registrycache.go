package registrycache

import (
	"context"
	"fmt"
	"slices"

	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	CleanupCronJobName     = "registry-cleanup"
	CleanupContainerName   = "registry-cleanup"
	RegistryPVCName        = "registry-pvc"
	RegistryServiceName    = "docker-registry"
	RegistryServicePort    = 5000
	ThresholdEnvVar        = "MAX_STORAGE"
	DefaultCleanupSchedule = "0 * * * *"
	cleanupTimeoutSeconds  = 3600
)

var cleanupCommand = []string{"/app/cli", "registry:cleanup"}

// RegistryURL is the in-cluster address of the self-hosted registry.
func RegistryURL(namespace string) string {
	return fmt.Sprintf("http://%s.%s:%d", RegistryServiceName, namespace, RegistryServicePort)
}

// Manager configures and inspects the self-hosted registry cache (build cache +
// images share a single registry volume). All operations target the system
// namespace; when the registry is externally managed the resources are absent.
type Manager struct {
	cfg      *config.Config
	k8s      *k8s.KubeClient
	registry *Client
}

func NewManager(cfg *config.Config, k8sClient *k8s.KubeClient) *Manager {
	return &Manager{
		cfg:      cfg,
		k8s:      k8sClient,
		registry: NewClient(RegistryURL(cfg.GetSystemNamespace())),
	}
}

func (self *Manager) namespace() string {
	return self.cfg.GetSystemNamespace()
}

// IsManaged reports whether this system runs the self-hosted registry cleanup
// job. False indicates an external registry, where cache config does not apply.
func (self *Manager) IsManaged(ctx context.Context) bool {
	_, err := self.getCronJob(ctx)
	return err == nil
}

func (self *Manager) getCronJob(ctx context.Context) (*batchv1.CronJob, error) {
	return self.k8s.GetInternalClient().BatchV1().CronJobs(self.namespace()).Get(ctx, CleanupCronJobName, metav1.GetOptions{})
}

func (self *Manager) cleanupContainer(cron *batchv1.CronJob) *corev1.Container {
	containers := cron.Spec.JobTemplate.Spec.Template.Spec.Containers
	for i := range containers {
		if containers[i].Name == CleanupContainerName {
			return &containers[i]
		}
	}
	if len(containers) > 0 {
		return &containers[0]
	}
	return nil
}

// GetThreshold returns the configured cleanup threshold (e.g. "4Gi").
func (self *Manager) GetThreshold(ctx context.Context) (string, error) {
	cron, err := self.getCronJob(ctx)
	if err != nil {
		return "", err
	}
	container := self.cleanupContainer(cron)
	if container == nil {
		return "", fmt.Errorf("cleanup container not found")
	}
	for _, env := range container.Env {
		if env.Name == ThresholdEnvVar {
			return env.Value, nil
		}
	}
	return "", fmt.Errorf("%s env not found on cleanup job", ThresholdEnvVar)
}

// GetSchedule returns the cron schedule of the cleanup job.
func (self *Manager) GetSchedule(ctx context.Context) (string, error) {
	cron, err := self.getCronJob(ctx)
	if err != nil {
		return "", err
	}
	return cron.Spec.Schedule, nil
}

// Apply updates the cleanup threshold and/or schedule on the cleanup CronJob.
// Nil fields are left untouched.
func (self *Manager) Apply(ctx context.Context, threshold *string, schedule *string) error {
	cron, err := self.getCronJob(ctx)
	if err != nil {
		return err
	}

	if schedule != nil {
		cron.Spec.Schedule = *schedule
	}

	if threshold != nil {
		container := self.cleanupContainer(cron)
		if container == nil {
			return fmt.Errorf("cleanup container not found")
		}
		updated := false
		for i := range container.Env {
			if container.Env[i].Name == ThresholdEnvVar {
				container.Env[i].Value = *threshold
				updated = true
				break
			}
		}
		if !updated {
			container.Env = append(container.Env, corev1.EnvVar{Name: ThresholdEnvVar, Value: *threshold})
		}
	}

	_, err = self.k8s.GetInternalClient().BatchV1().CronJobs(self.namespace()).Update(ctx, cron, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update cleanup cronjob: %w", err)
	}
	return nil
}

// MigrateCleanupJob moves a CronJob still running the pre-v0.1.39 shell script onto the CLI.
func (self *Manager) MigrateCleanupJob(ctx context.Context, image string) error {
	cron, err := self.getCronJob(ctx)
	if err != nil {
		return err
	}
	container := self.cleanupContainer(cron)
	if container == nil {
		return fmt.Errorf("cleanup container not found")
	}
	if !convertCleanupContainer(container, image) {
		return nil
	}

	cron.Spec.JobTemplate.Spec.ActiveDeadlineSeconds = new(int64(cleanupTimeoutSeconds))
	if _, err := self.k8s.GetInternalClient().BatchV1().CronJobs(self.namespace()).Update(ctx, cron, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("failed to migrate cleanup cronjob: %w", err)
	}
	return nil
}

func convertCleanupContainer(container *corev1.Container, image string) bool {
	if slices.Equal(container.Command, cleanupCommand) {
		return false
	}

	threshold := ""
	for _, env := range container.Env {
		if env.Name == ThresholdEnvVar {
			threshold = env.Value
		}
	}

	container.Image = image
	container.ImagePullPolicy = corev1.PullAlways
	container.Command = cleanupCommand
	container.Args = nil
	container.Env = []corev1.EnvVar{
		{Name: "SYSTEM_NAMESPACE", ValueFrom: &corev1.EnvVarSource{FieldRef: &corev1.ObjectFieldSelector{FieldPath: "metadata.namespace"}}},
		{Name: ThresholdEnvVar, Value: threshold},
	}
	container.Resources = corev1.ResourceRequirements{
		Requests: corev1.ResourceList{
			corev1.ResourceCPU:    resource.MustParse("50m"),
			corev1.ResourceMemory: resource.MustParse("64Mi"),
		},
		Limits: corev1.ResourceList{
			corev1.ResourceMemory: resource.MustParse("256Mi"),
		},
	}
	return true
}

// PVCInfo describes the registry volume sizing.
type PVCInfo struct {
	RequestedBytes int64
	CapacityBytes  int64
	StorageClass   string
	CanExpand      bool
}

// EffectiveBytes is the real size of the volume: the provisioned capacity when
// known (it may exceed the request after expansion or rounding), else the
// request while provisioning is still in flight.
func (self *PVCInfo) EffectiveBytes() int64 {
	if self.CapacityBytes > 0 {
		return self.CapacityBytes
	}
	return self.RequestedBytes
}

func (self *Manager) GetPVC(ctx context.Context) (*PVCInfo, error) {
	pvc, err := self.k8s.GetInternalClient().CoreV1().PersistentVolumeClaims(self.namespace()).Get(ctx, RegistryPVCName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	info := &PVCInfo{}
	if req, ok := pvc.Spec.Resources.Requests[corev1.ResourceStorage]; ok {
		info.RequestedBytes = req.Value()
	}
	if cap, ok := pvc.Status.Capacity[corev1.ResourceStorage]; ok {
		info.CapacityBytes = cap.Value()
	}
	if pvc.Spec.StorageClassName != nil {
		info.StorageClass = *pvc.Spec.StorageClassName
		sc, err := self.k8s.GetInternalClient().StorageV1().StorageClasses().Get(ctx, *pvc.Spec.StorageClassName, metav1.GetOptions{})
		if err == nil && sc.AllowVolumeExpansion != nil {
			info.CanExpand = *sc.AllowVolumeExpansion
		}
	}
	return info, nil
}

// UpdatePVCCapacity patches the registry PVC storage request (grow-only is
// enforced by the caller). newSize must be a valid resource quantity string.
func (self *Manager) UpdatePVCCapacity(ctx context.Context, newSize string) error {
	qty, err := resource.ParseQuantity(newSize)
	if err != nil {
		return fmt.Errorf("invalid size %q: %w", newSize, err)
	}
	pvc, err := self.k8s.GetInternalClient().CoreV1().PersistentVolumeClaims(self.namespace()).Get(ctx, RegistryPVCName, metav1.GetOptions{})
	if err != nil {
		return err
	}
	if pvc.Spec.Resources.Requests == nil {
		pvc.Spec.Resources.Requests = corev1.ResourceList{}
	}
	pvc.Spec.Resources.Requests[corev1.ResourceStorage] = qty
	_, err = self.k8s.GetInternalClient().CoreV1().PersistentVolumeClaims(self.namespace()).Update(ctx, pvc, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to resize registry pvc: %w", err)
	}
	return nil
}

// GetLastCleanup returns the latest cleanup Job spawned by the CronJob.
func (self *Manager) GetLastCleanup(ctx context.Context) (*models.RegistryCacheCleanupRun, error) {
	jobList, err := self.k8s.GetInternalClient().BatchV1().Jobs(self.namespace()).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var latest *batchv1.Job
	for i := range jobList.Items {
		job := &jobList.Items[i]
		if !ownedByCleanupCron(job) {
			continue
		}
		if latest == nil || job.CreationTimestamp.After(latest.CreationTimestamp.Time) {
			latest = job
		}
	}
	if latest == nil {
		return nil, nil
	}

	run := &models.RegistryCacheCleanupRun{Status: "running"}
	if latest.Status.StartTime != nil {
		run.StartedAt = &latest.Status.StartTime.Time
	}
	switch {
	case latest.Status.Succeeded > 0:
		run.Status = "succeeded"
		if latest.Status.CompletionTime != nil {
			run.FinishedAt = &latest.Status.CompletionTime.Time
		}
	case latest.Status.Failed > 0:
		run.Status = "failed"
	}
	return run, nil
}

func ownedByCleanupCron(job *batchv1.Job) bool {
	for _, ref := range job.OwnerReferences {
		if ref.Kind == "CronJob" && ref.Name == CleanupCronJobName {
			return true
		}
	}
	return false
}

// UsageStats describes current registry contents and disk usage.
type UsageStats struct {
	UsedBytes       int64 `json:"used_bytes"`
	RepositoryCount int   `json:"repository_count"`
	TagCount        int   `json:"tag_count"`
}

// GetUsage walks the registry catalog and sums unique blob sizes (registry
// stores each blob once, so deduping by digest yields real disk usage).
func (self *Manager) GetUsage(ctx context.Context) (*UsageStats, error) {
	repos, err := self.registry.Repositories(ctx)
	if err != nil {
		return nil, err
	}

	stats := &UsageStats{RepositoryCount: len(repos)}
	blobs := map[string]int64{}

	for _, repo := range repos {
		tags, err := self.registry.Tags(ctx, repo)
		if err != nil {
			log.Warnf("registry cache: failed to list tags for %s: %v", repo, err)
			continue
		}
		stats.TagCount += len(tags)
		for _, tag := range tags {
			if err := collectBlobs(ctx, self.registry, repo, tag, blobs, 0); err != nil {
				log.Warnf("registry cache: failed to read manifest %s:%s: %v", repo, tag, err)
			}
		}
	}

	for _, size := range blobs {
		stats.UsedBytes += size
	}
	return stats, nil
}
