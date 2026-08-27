package updater

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	gh "github.com/google/go-github/v69/github"
	"github.com/redis/go-redis/v9"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/infrastructure/cache"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/pkg/release"
	"golang.org/x/mod/semver"
	"sigs.k8s.io/kustomize/api/krusty"
	"sigs.k8s.io/kustomize/api/types"
	"sigs.k8s.io/kustomize/kyaml/filesys"
	"sigs.k8s.io/yaml"
)

// Updater handles the update process for the application
type Updater struct {
	cfg            *config.Config
	releaseManager release.ManagerInterface
	CurrentVersion string
	k8sClient      k8s.KubeClientInterface
	httpClient     *http.Client

	// Cache for updates
	redisCache *cache.RedisCache[*UpdateCacheItem]
}

type UpdateCacheItem struct {
	// ForVersion is the version the list was computed against; an entry written by
	// another binary may contain the version this binary already runs.
	ForVersion string
	Updates    []release.VersionMetadata
	CheckedAt  time.Time
}

const (
	updatesCacheKey       = "updates"
	updatesCacheTTL       = time.Hour
	updatesCacheFreshness = 10 * time.Minute
)

// New creates a new updater instance
func New(cfg *config.Config, currentVersion string, k8sClient k8s.KubeClientInterface, redisClient *redis.Client) *Updater {
	httpClient := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Create unauthenticated GitHub client for public repositories
	githubClient := gh.NewClient(httpClient)

	// Create string cache
	redisCache := cache.NewCache[*UpdateCacheItem](redisClient, "unbind-updater")

	return &Updater{
		cfg:            cfg,
		releaseManager: release.NewManager(NewGitHubClientWrapper(githubClient), cfg.ReleaseRepoOverride),
		CurrentVersion: currentVersion,
		k8sClient:      k8sClient,
		httpClient:     httpClient,
		redisCache:     redisCache,
	}
}

// NewWithReleaseManager creates a new updater instance with a custom release manager (useful for testing)
func NewWithReleaseManager(cfg *config.Config, currentVersion string, k8sClient k8s.KubeClientInterface, redisClient *redis.Client, releaseManager release.ManagerInterface) *Updater {
	httpClient := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Create string cache
	redisCache := cache.NewCache[*UpdateCacheItem](redisClient, "unbind-updater")

	return &Updater{
		cfg:            cfg,
		releaseManager: releaseManager,
		CurrentVersion: currentVersion,
		k8sClient:      k8sClient,
		httpClient:     httpClient,
		redisCache:     redisCache,
	}
}

// CheckForUpdates checks if there are any available updates
func (self *Updater) CheckForUpdates(ctx context.Context) ([]release.VersionMetadata, error) {
	cacheItem, err := self.redisCache.Get(ctx, updatesCacheKey)
	if err != nil {
		if err != redis.Nil {
			log.Errorf("Error reading from cache: %v", err)
		}
		cacheItem = nil
	} else if cacheItem != nil && cacheItem.ForVersion != self.CurrentVersion {
		cacheItem = nil
	}

	if cacheItem != nil && time.Since(cacheItem.CheckedAt) < updatesCacheFreshness {
		log.Infof("Returning cached updates from %v", cacheItem.CheckedAt)
		return self.newerThanCurrent(cacheItem.Updates), nil
	}

	// Cache expired or empty, fetch new updates
	updates, err := self.releaseManager.AvailableUpdates(ctx, self.CurrentVersion)
	if err != nil {
		if cacheItem != nil {
			log.Errorf("Failed to check for updates, returning stale cache from %v: %v", cacheItem.CheckedAt, err)
			return self.newerThanCurrent(cacheItem.Updates), nil
		}

		log.Errorf("Failed to check for updates and no cache available: %v", err)
		return []release.VersionMetadata{}, nil
	}

	cacheItem = &UpdateCacheItem{
		ForVersion: self.CurrentVersion,
		Updates:    updates,
		CheckedAt:  time.Now(),
	}
	if err := self.redisCache.SetWithExpiration(ctx, updatesCacheKey, cacheItem, updatesCacheTTL); err != nil {
		log.Errorf("Failed to cache updates: %v", err)
	}

	return self.newerThanCurrent(updates), nil
}

// newerThanCurrent drops anything at or below the running version so no cache
// entry, however stale, can report the current version as an update.
func (self *Updater) newerThanCurrent(updates []release.VersionMetadata) []release.VersionMetadata {
	current := self.CurrentVersion
	if !strings.HasPrefix(current, "v") {
		current = "v" + current
	}
	if !semver.IsValid(current) {
		return updates
	}

	filtered := make([]release.VersionMetadata, 0, len(updates))
	for _, update := range updates {
		if semver.Compare(update.Version, current) <= 0 {
			continue
		}
		filtered = append(filtered, update)
	}
	return filtered
}

// ClearUpdatesCache drops the cached release list so the next check hits GitHub.
func (self *Updater) ClearUpdatesCache(ctx context.Context) error {
	return self.redisCache.Delete(ctx, updatesCacheKey)
}

// ReleaseURL returns the GitHub release page URL for the given version
func (self *Updater) ReleaseURL(version string) string {
	return self.releaseManager.ReleaseURL(version)
}

// GetLatestVersion returns the latest available version
func (self *Updater) GetLatestVersion(ctx context.Context) (string, error) {
	version, err := self.releaseManager.GetLatestVersion(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get latest version: %w", err)
	}
	return version, nil
}

// GetUpdatePath returns the ordered list of versions needed to update from current to target
func (self *Updater) GetUpdatePath(ctx context.Context, targetVersion string) ([]string, error) {
	path, err := self.releaseManager.GetUpdatePath(ctx, self.CurrentVersion, targetVersion)
	if err != nil {
		return nil, fmt.Errorf("failed to get update path: %w", err)
	}
	return path, nil
}

// UpdateToVersion updates the application to the specified version
func (self *Updater) UpdateToVersion(ctx context.Context, targetVersion string) error {
	updatePath, err := self.GetUpdatePath(ctx, targetVersion)
	if err != nil {
		return fmt.Errorf("failed to get update path: %w", err)
	}

	// Apply Kustomize manifests for each version in the path
	for _, version := range updatePath {
		if err := self.applyKustomizeManifests(ctx, version); err != nil {
			// If an error occurs, attempt to rollback to the previous version
			if rollbackErr := self.rollbackToVersion(ctx, self.CurrentVersion); rollbackErr != nil {
				return fmt.Errorf("failed to apply kustomize manifests for version %s and rollback failed: %v (rollback error: %v)", version, err, rollbackErr)
			}
			return fmt.Errorf("failed to apply kustomize manifests for version %s: %w", version, err)
		}
	}

	// Only update deployment images for the final target version
	if err := self.k8sClient.UpdateDeploymentImages(ctx, targetVersion); err != nil {
		// If an error occurs, attempt to rollback to the previous version
		if rollbackErr := self.rollbackToVersion(ctx, self.CurrentVersion); rollbackErr != nil {
			return fmt.Errorf("failed to update deployment images and rollback failed: %v (rollback error: %v)", err, rollbackErr)
		}
		return fmt.Errorf("failed to update deployment images: %w", err)
	}

	return nil
}

// applyKustomizeManifests applies the optional per-version kustomization shipped in the release repo.
func (self *Updater) applyKustomizeManifests(ctx context.Context, version string) error {
	dir, err := os.MkdirTemp("", "unbind-update-*")
	if err != nil {
		return fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer os.RemoveAll(dir)

	found, err := self.releaseManager.DownloadVersionManifests(ctx, version, dir)
	if err != nil {
		return err
	}
	if !found {
		return nil
	}

	if err := setKustomizationNamespace(filepath.Join(dir, release.KustomizationFile), self.cfg.GetSystemNamespace()); err != nil {
		return err
	}

	opts := krusty.MakeDefaultOptions()
	opts.LoadRestrictions = types.LoadRestrictionsNone
	resMap, err := krusty.MakeKustomizer(opts).Run(filesys.MakeFsOnDisk(), dir)
	if err != nil {
		return fmt.Errorf("failed to build kustomization: %w", err)
	}

	yaml, err := resMap.AsYaml()
	if err != nil {
		return fmt.Errorf("failed to convert resources to YAML: %w", err)
	}
	// An empty kustomization acknowledges the release CI guard without running a job.
	if len(bytes.TrimSpace(yaml)) == 0 {
		return nil
	}

	if err := self.k8sClient.RunManifestApplyJob(ctx, version, self.jobImage(), yaml); err != nil {
		return fmt.Errorf("failed to apply resources: %w", err)
	}

	return nil
}

// jobImage picks the image the manifest-apply job runs: the running app image, which is
// already pullable mid-update and is the binary that rendered the manifests.
func (self *Updater) jobImage() string {
	if image := self.cfg.GetUpdateJobImage(); image != "" {
		return image
	}
	return k8s.AppImageRepository + ":" + self.CurrentVersion
}

func setKustomizationNamespace(path, namespace string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read kustomization file: %w", err)
	}

	var kustomization types.Kustomization
	if err := yaml.Unmarshal(data, &kustomization); err != nil {
		return fmt.Errorf("failed to parse kustomization file: %w", err)
	}
	kustomization.Namespace = namespace

	data, err = yaml.Marshal(&kustomization)
	if err != nil {
		return fmt.Errorf("failed to encode kustomization file: %w", err)
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write kustomization file: %w", err)
	}

	return nil
}

// rollbackToVersion rolls back to a specific version
func (self *Updater) rollbackToVersion(ctx context.Context, version string) error {
	if err := self.k8sClient.UpdateDeploymentImages(ctx, version); err != nil {
		return fmt.Errorf("failed to rollback deployment images: %w", err)
	}

	return nil
}

// CheckUpdateComplete reports whether the update to targetVersion has fully rolled out.
// A process running any other version never reports complete regardless of cluster
// state — "updated" may only come from the binary that is the target version.
func (self *Updater) CheckUpdateComplete(ctx context.Context, targetVersion string) (bool, error) {
	if targetVersion != self.CurrentVersion {
		return false, nil
	}
	return self.k8sClient.CheckDeploymentsReady(ctx, targetVersion)
}
