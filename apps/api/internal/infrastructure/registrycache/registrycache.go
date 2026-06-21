package registrycache

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"time"

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
)

// Manager configures and inspects the self-hosted registry cache (build cache +
// images share a single registry volume). All operations target the system
// namespace; when the registry is externally managed the resources are absent.
type Manager struct {
	cfg  *config.Config
	k8s  *k8s.KubeClient
	http *http.Client
}

func NewManager(cfg *config.Config, k8sClient *k8s.KubeClient) *Manager {
	return &Manager{
		cfg:  cfg,
		k8s:  k8sClient,
		http: &http.Client{Timeout: 30 * time.Second},
	}
}

func (self *Manager) namespace() string {
	return self.cfg.GetSystemNamespace()
}

func (self *Manager) registryURL() string {
	return fmt.Sprintf("http://%s.%s:%d", RegistryServiceName, self.namespace(), RegistryServicePort)
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
	repos, err := self.fetchRepositories(ctx)
	if err != nil {
		return nil, err
	}

	stats := &UsageStats{RepositoryCount: len(repos)}
	blobs := map[string]int64{}

	for _, repo := range repos {
		tags, err := self.fetchTags(ctx, repo)
		if err != nil {
			log.Warnf("registry cache: failed to list tags for %s: %v", repo, err)
			continue
		}
		stats.TagCount += len(tags)
		for _, tag := range tags {
			if err := self.collectBlobs(ctx, repo, tag, blobs, 0); err != nil {
				log.Warnf("registry cache: failed to read manifest %s:%s: %v", repo, tag, err)
			}
		}
	}

	for _, size := range blobs {
		stats.UsedBytes += size
	}
	return stats, nil
}

func (self *Manager) fetchRepositories(ctx context.Context) ([]string, error) {
	var out struct {
		Repositories []string `json:"repositories"`
	}
	if err := self.getJSON(ctx, fmt.Sprintf("%s/v2/_catalog", self.registryURL()), nil, &out); err != nil {
		return nil, err
	}
	sort.Strings(out.Repositories)
	return out.Repositories, nil
}

func (self *Manager) fetchTags(ctx context.Context, repo string) ([]string, error) {
	var out struct {
		Tags []string `json:"tags"`
	}
	if err := self.getJSON(ctx, fmt.Sprintf("%s/v2/%s/tags/list", self.registryURL(), repo), nil, &out); err != nil {
		return nil, err
	}
	return out.Tags, nil
}

const manifestAccept = "application/vnd.oci.image.manifest.v1+json, application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.docker.distribution.manifest.list.v2+json"

// collectBlobs accumulates unique config+layer blob sizes for a manifest
// reference, recursing into image indexes (multi-arch) one level.
func (self *Manager) collectBlobs(ctx context.Context, repo, ref string, blobs map[string]int64, depth int) error {
	if depth > 2 {
		return nil
	}

	var manifest struct {
		Manifests []struct {
			Digest string `json:"digest"`
		} `json:"manifests"`
		Config struct {
			Digest string `json:"digest"`
			Size   int64  `json:"size"`
		} `json:"config"`
		Layers []struct {
			Digest string `json:"digest"`
			Size   int64  `json:"size"`
		} `json:"layers"`
	}

	headers := map[string]string{"Accept": manifestAccept}
	if err := self.getJSON(ctx, fmt.Sprintf("%s/v2/%s/manifests/%s", self.registryURL(), repo, ref), headers, &manifest); err != nil {
		return err
	}

	if len(manifest.Manifests) > 0 {
		for _, sub := range manifest.Manifests {
			if err := self.collectBlobs(ctx, repo, sub.Digest, blobs, depth+1); err != nil {
				log.Warnf("registry cache: failed sub-manifest %s@%s: %v", repo, sub.Digest, err)
			}
		}
		return nil
	}

	if manifest.Config.Digest != "" {
		blobs[manifest.Config.Digest] = manifest.Config.Size
	}
	for _, layer := range manifest.Layers {
		blobs[layer.Digest] = layer.Size
	}
	return nil
}

func (self *Manager) getJSON(ctx context.Context, url string, headers map[string]string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := self.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("registry returned %d: %s", resp.StatusCode, string(body))
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
