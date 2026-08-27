package release

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/google/go-github/v69/github"
	"golang.org/x/mod/semver"
)

const (
	DefaultOwner  = "unbindapp"
	DefaultRepo   = "unbind"
	DefaultBranch = "master"
	// MetadataPath is the repo-relative path of the release metadata, read from DefaultBranch.
	MetadataPath = "deploy/releases/metadata.json"
	// ManifestsDir holds optional per-version kustomizations (ManifestsDir/<version>/kustomization.yaml), read at the version's tag.
	ManifestsDir      = "deploy/releases"
	KustomizationFile = "kustomization.yaml"
)

type GitHubClientInterface interface {
	Repositories() RepositoriesServiceInterface
}

type RepositoriesServiceInterface interface {
	ListReleases(ctx context.Context, owner, repo string, opts *github.ListOptions) ([]*github.RepositoryRelease, *github.Response, error)
	GetContents(ctx context.Context, owner, repo, path string, opts *github.RepositoryContentGetOptions) (*github.RepositoryContent, []*github.RepositoryContent, *github.Response, error)
}

type ManagerInterface interface {
	AvailableUpdates(ctx context.Context, currentVersion string) ([]VersionMetadata, error)
	GetLatestVersion(ctx context.Context) (string, error)
	GetUpdatePath(ctx context.Context, currentVersion, targetVersion string) ([]string, error)
	DownloadVersionManifests(ctx context.Context, version, destDir string) (bool, error)
	ReleaseURL(version string) string
}

type Manager struct {
	client      GitHubClientInterface
	httpClient  *http.Client
	owner       string
	repo        string
	metadataURL string
}

// NewManager creates a release manager for DefaultOwner/DefaultRepo; repoOverride may be "repo" or "owner/repo".
func NewManager(client GitHubClientInterface, repoOverride string) *Manager {
	owner, repo := DefaultOwner, DefaultRepo
	if o, r, ok := strings.Cut(repoOverride, "/"); ok {
		owner, repo = o, r
	} else if repoOverride != "" {
		repo = repoOverride
	}

	return &Manager{
		client:      client,
		httpClient:  &http.Client{Timeout: 30 * time.Second},
		owner:       owner,
		repo:        repo,
		metadataURL: fmt.Sprintf("https://raw.githubusercontent.com/%s/%s/%s/%s", owner, repo, DefaultBranch, MetadataPath),
	}
}

func normalizeVersion(version string) string {
	if strings.HasPrefix(version, "v") {
		return version
	}
	return "v" + version
}

// ReleaseURL returns the GitHub releases page anchored to version, or the plain index when version isn't a valid semver tag.
func (self *Manager) ReleaseURL(version string) string {
	normalized := normalizeVersion(version)
	if !semver.IsValid(normalized) {
		return fmt.Sprintf("https://github.com/%s/%s/releases", self.owner, self.repo)
	}
	return fmt.Sprintf("https://github.com/%s/%s/releases#release-%s", self.owner, self.repo, normalized)
}

func (self *Manager) publishedReleaseTags(ctx context.Context) (map[string]bool, error) {
	published := make(map[string]bool)
	opts := &github.ListOptions{PerPage: 100}
	for {
		releases, resp, err := self.client.Repositories().ListReleases(ctx, self.owner, self.repo, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to list releases: %w", err)
		}
		for _, release := range releases {
			if tag := release.GetTagName(); tag != "" {
				published[tag] = true
			}
		}
		if resp == nil || resp.NextPage == 0 {
			return published, nil
		}
		opts.Page = resp.NextPage
	}
}

// releasedVersions returns, in ascending semver order, every version that has both a published GitHub release and a metadata entry.
func (self *Manager) releasedVersions(ctx context.Context) ([]string, VersionMetadataMap, error) {
	published, err := self.publishedReleaseTags(ctx)
	if err != nil {
		return nil, nil, err
	}

	metadata, err := self.GetVersionMetadata(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get version metadata: %w", err)
	}

	versions := make([]string, 0, len(published))
	for tag := range published {
		if !semver.IsValid(tag) {
			continue
		}
		if _, ok := metadata[tag]; !ok {
			continue
		}
		versions = append(versions, tag)
	}
	semver.Sort(versions)

	return versions, metadata, nil
}

func canUpdateTo(meta VersionMetadata, currentVersion string) bool {
	if len(meta.DependsOn) > 0 {
		return slices.Contains(meta.DependsOn, currentVersion)
	}
	return !meta.Breaking
}

// AvailableUpdates returns the versions newer than currentVersion that it may update to, oldest first.
func (self *Manager) AvailableUpdates(ctx context.Context, currentVersion string) ([]VersionMetadata, error) {
	currentVersion = normalizeVersion(currentVersion)
	if !semver.IsValid(currentVersion) {
		return []VersionMetadata{}, nil
	}

	versions, metadata, err := self.releasedVersions(ctx)
	if err != nil {
		return nil, err
	}

	updates := make([]VersionMetadata, 0, len(versions))
	for _, version := range versions {
		if semver.Compare(version, currentVersion) <= 0 {
			continue
		}
		if !canUpdateTo(metadata[version], currentVersion) {
			continue
		}
		meta := metadata[version]
		meta.Version = version
		updates = append(updates, meta)
	}

	return updates, nil
}

func (self *Manager) GetLatestVersion(ctx context.Context) (string, error) {
	versions, _, err := self.releasedVersions(ctx)
	if err != nil {
		return "", err
	}
	if len(versions) == 0 {
		return "", fmt.Errorf("no versions found")
	}
	return versions[len(versions)-1], nil
}

// GetUpdatePath returns the ordered versions to step through from currentVersion to targetVersion, or an empty list when unreachable.
func (self *Manager) GetUpdatePath(ctx context.Context, currentVersion, targetVersion string) ([]string, error) {
	currentVersion = normalizeVersion(currentVersion)
	targetVersion = normalizeVersion(targetVersion)
	if !semver.IsValid(currentVersion) || !semver.IsValid(targetVersion) {
		return []string{}, nil
	}

	versions, metadata, err := self.releasedVersions(ctx)
	if err != nil {
		return nil, err
	}

	currentIdx := slices.Index(versions, currentVersion)
	targetIdx := slices.Index(versions, targetVersion)
	if currentIdx == -1 || targetIdx == -1 || targetIdx <= currentIdx {
		return []string{}, nil
	}

	path := make([]string, 0, targetIdx-currentIdx)
	for _, version := range versions[currentIdx+1 : targetIdx+1] {
		if !canUpdateTo(metadata[version], currentVersion) {
			return []string{}, nil
		}
		path = append(path, version)
		currentVersion = version
	}

	return path, nil
}

// DownloadVersionManifests copies ManifestsDir/<version> at the version's tag into destDir and reports whether it contained a kustomization.
func (self *Manager) DownloadVersionManifests(ctx context.Context, version, destDir string) (bool, error) {
	path := ManifestsDir + "/" + version
	_, entries, resp, err := self.client.Repositories().GetContents(ctx, self.owner, self.repo, path, &github.RepositoryContentGetOptions{Ref: version})
	if resp != nil && resp.StatusCode == http.StatusNotFound {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to list manifests for %s: %w", version, err)
	}

	hasKustomization := false
	for _, entry := range entries {
		if entry.GetType() != "file" {
			continue
		}
		if entry.GetName() == KustomizationFile {
			hasKustomization = true
		}
		if err := self.downloadFile(ctx, entry.GetDownloadURL(), filepath.Join(destDir, entry.GetName())); err != nil {
			return false, fmt.Errorf("failed to download %s/%s: %w", path, entry.GetName(), err)
		}
	}

	return hasKustomization, nil
}

func (self *Manager) downloadFile(ctx context.Context, url, dest string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := self.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status %d", resp.StatusCode)
	}

	file, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = io.Copy(file, resp.Body)
	return err
}
