package registrycache

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strings"

	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	CleanupCronJobName     = k8s.RegistryCleanupCronJobName
	CleanupContainerName   = "registry-cleanup"
	CleanupRoleName        = "registry-cleanup-role"
	RegistryPVCName        = "registry-pvc"
	RegistryServiceName    = "docker-registry"
	RegistryServicePort    = 5000
	ThresholdEnvVar        = "MAX_STORAGE"
	DefaultCleanupSchedule = "0 * * * *"
	PruneAllFlag           = "--all"
	TerminationMessagePath = "/dev/termination-log"
	cleanupTimeoutSeconds  = 3600
	// Set by kubectl create job --from=cronjob as well
	manualRunAnnotation = "cronjob.kubernetes.io/instantiate"
	manualRunValue      = "manual"
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
	cfg     *config.Config
	k8s     *k8s.KubeClient
	cleaner *Cleaner
}

func NewManager(cfg *config.Config, k8sClient *k8s.KubeClient) *Manager {
	return &Manager{
		cfg:     cfg,
		k8s:     k8sClient,
		cleaner: newCleaner(cfg.GetSystemNamespace(), k8sClient.GetInternalClient(), k8sClient.GetInternalRestConfig()),
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
	return cleanupContainerOf(&cron.Spec.JobTemplate.Spec.Template.Spec)
}

func cleanupContainerOf(spec *corev1.PodSpec) *corev1.Container {
	containers := spec.Containers
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

// MigrateCleanupJob brings a CronJob created by an older chart up to the current one.
func (self *Manager) MigrateCleanupJob(ctx context.Context, image string) error {
	cron, err := self.getCronJob(ctx)
	if err != nil {
		return err
	}
	container := self.cleanupContainer(cron)
	if container == nil {
		return fmt.Errorf("cleanup container not found")
	}

	jobSpec := &cron.Spec.JobTemplate.Spec
	changed := convertCleanupContainer(container, image)
	if changed {
		jobSpec.ActiveDeadlineSeconds = new(int64(cleanupTimeoutSeconds))
	}
	// Builds wait while the job runs, so a failed run must not keep retrying
	if jobSpec.BackoffLimit == nil || *jobSpec.BackoffLimit != 0 {
		jobSpec.BackoffLimit = new(int32(0))
		changed = true
	}

	if changed {
		if _, err := self.k8s.GetInternalClient().BatchV1().CronJobs(self.namespace()).Update(ctx, cron, metav1.UpdateOptions{}); err != nil {
			return fmt.Errorf("failed to migrate cleanup cronjob: %w", err)
		}
	}
	return self.grantCleanupJobList(ctx)
}

func (self *Manager) grantCleanupJobList(ctx context.Context) error {
	roles := self.k8s.GetInternalClient().RbacV1().Roles(self.namespace())
	role, err := roles.Get(ctx, CleanupRoleName, metav1.GetOptions{})
	if err != nil {
		return err
	}
	if !grantJobList(role) {
		return nil
	}
	if _, err := roles.Update(ctx, role, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("failed to update cleanup role: %w", err)
	}
	return nil
}

func grantJobList(role *rbacv1.Role) bool {
	for _, rule := range role.Rules {
		if slices.Contains(rule.APIGroups, "batch") && slices.Contains(rule.Resources, "jobs") && slices.Contains(rule.Verbs, "list") {
			return false
		}
	}
	role.Rules = append(role.Rules, rbacv1.PolicyRule{
		APIGroups: []string{"batch"},
		Resources: []string{"jobs"},
		Verbs:     []string{"list"},
	})
	return true
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

// IsPendingResize reports a growth that was requested but has not reached the volume yet.
func (self *PVCInfo) IsPendingResize() bool {
	return self.CapacityBytes > 0 && self.RequestedBytes > self.CapacityBytes
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

// StartCleanup runs the cleanup job now, deleting every image cleanup is allowed to delete.
func (self *Manager) StartCleanup(ctx context.Context) error {
	cron, err := self.getCronJob(ctx)
	if err != nil {
		return err
	}

	job := manualCleanupJob(cron)
	if _, err := self.k8s.GetInternalClient().BatchV1().Jobs(self.namespace()).Create(ctx, job, metav1.CreateOptions{}); err != nil {
		return fmt.Errorf("failed to start registry cleanup: %w", err)
	}
	return nil
}

// Owned by the CronJob so builds wait for it and the CronJob's history limits remove it
func manualCleanupJob(cron *batchv1.CronJob) *batchv1.Job {
	annotations := map[string]string{manualRunAnnotation: manualRunValue}
	for key, value := range cron.Spec.JobTemplate.Annotations {
		annotations[key] = value
	}

	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName:    CleanupCronJobName + "-manual-",
			Namespace:       cron.Namespace,
			Labels:          cron.Spec.JobTemplate.Labels,
			Annotations:     annotations,
			OwnerReferences: []metav1.OwnerReference{*metav1.NewControllerRef(cron, batchv1.SchemeGroupVersion.WithKind("CronJob"))},
		},
		Spec: *cron.Spec.JobTemplate.Spec.DeepCopy(),
	}
	if container := cleanupContainerOf(&job.Spec.Template.Spec); container != nil && !slices.Contains(container.Args, PruneAllFlag) {
		container.Args = append(container.Args, PruneAllFlag)
	}
	return job
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

	run := &models.RegistryCacheCleanupRun{
		Status: "running",
		Manual: latest.Annotations[manualRunAnnotation] == manualRunValue,
	}
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
	if run.Status != "running" {
		run.Result = self.cleanupResult(ctx, latest.Name)
	}
	return run, nil
}

// The job reports its result as the container's termination message
func (self *Manager) cleanupResult(ctx context.Context, jobName string) *models.RegistryCleanupResult {
	pods, err := self.k8s.GetInternalClient().CoreV1().Pods(self.namespace()).List(ctx, metav1.ListOptions{LabelSelector: "job-name=" + jobName})
	if err != nil {
		log.Warnf("registry cache: failed to list pods of %s: %v", jobName, err)
		return nil
	}

	for _, pod := range pods.Items {
		for _, status := range pod.Status.ContainerStatuses {
			if status.Name != CleanupContainerName {
				continue
			}
			for _, terminated := range []*corev1.ContainerStateTerminated{status.State.Terminated, status.LastTerminationState.Terminated} {
				if terminated == nil {
					continue
				}
				if result := ParseCleanupResult(terminated.Message); result != nil {
					return result
				}
			}
		}
	}
	return nil
}

func ParseCleanupResult(message string) *models.RegistryCleanupResult {
	result := &models.RegistryCleanupResult{}
	if err := json.Unmarshal([]byte(message), result); err != nil {
		return nil
	}
	if result.Outcome == "" && result.Error == "" {
		return nil
	}
	return result
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
	UsedBytes       int64
	RepositoryCount int
	ImageCount      int
}

// GetUsage measures the volume the same way cleanup does, so the numbers agree with the threshold.
func (self *Manager) GetUsage(ctx context.Context) (*UsageStats, error) {
	pod, err := self.cleaner.registryPod(ctx)
	if err != nil {
		return nil, err
	}
	used, err := self.cleaner.diskUsage(ctx, pod)
	if err != nil {
		return nil, err
	}
	tags, err := self.cleaner.tagModTimes(ctx, pod)
	if err != nil {
		return nil, fmt.Errorf("failed to list registry tags: %w", err)
	}

	stats := countImages(tags)
	stats.UsedBytes = used
	return stats, nil
}

func countImages(tags map[string]int64) *UsageStats {
	stats := &UsageStats{}
	repos := map[string]bool{}
	for key := range tags {
		colon := strings.LastIndex(key, ":")
		repo, tag := key[:colon], key[colon+1:]
		repos[repo] = true
		if !isBuildCacheTag(tag) {
			stats.ImageCount++
		}
	}
	stats.RepositoryCount = len(repos)
	return stats
}
