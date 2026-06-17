package release

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"

	"golang.org/x/mod/semver"
)

// VersionMetadata represents the metadata for a specific version
type VersionMetadata struct {
	Version      string   `json:"version"`
	DependsOn    []string `json:"depends_on,omitempty"`    // Versions that must be installed before this one
	RequiredBy   []string `json:"required_by,omitempty"`   // Versions that require this version
	Breaking     bool     `json:"breaking,omitempty"`      // Whether this version contains breaking changes
	Description  string   `json:"description,omitempty"`   // Description of the version
	ReleaseNotes string   `json:"release_notes,omitempty"` // URL to release notes
}

// VersionMetadataMap maps version strings to their metadata
type VersionMetadataMap map[string]VersionMetadata

// GetVersionMetadata fetches the metadata for all versions
func (m *Manager) GetVersionMetadata(ctx context.Context) (VersionMetadataMap, error) {
	// Fetch the metadata file
	resp, err := http.Get(m.metadataURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch metadata: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch metadata: status code %d", resp.StatusCode)
	}

	// Read and parse the metadata
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read metadata: %w", err)
	}

	var metadata VersionMetadataMap
	if err := json.Unmarshal(data, &metadata); err != nil {
		return nil, fmt.Errorf("failed to parse metadata: %w", err)
	}

	return metadata, nil
}

// GetNextAvailableVersion returns the next version that can be updated to from the current version
func (m *Manager) GetNextAvailableVersion(ctx context.Context, currentVersion string) (string, error) {
	// Ensure current version has v prefix
	if !strings.HasPrefix(currentVersion, "v") {
		currentVersion = "v" + currentVersion
	}

	// Get all available updates
	updates, err := m.AvailableUpdates(ctx, currentVersion)
	if err != nil {
		return "", err
	}

	// Get version metadata
	metadata, err := m.GetVersionMetadata(ctx)
	if err != nil {
		return "", err
	}

	// Find the first version that can be updated to
	for _, version := range updates {
		// Skip if version doesn't have metadata
		versionMeta, exists := metadata[version]
		if !exists {
			continue
		}

		// Check if this version has any dependencies
		if len(versionMeta.DependsOn) == 0 {
			return version, nil
		}

		// Check if all dependencies are satisfied
		canUpdate := true
		for _, dep := range versionMeta.DependsOn {
			// If the dependency is newer than current version, we can't update yet
			if semver.Compare(dep, currentVersion) > 0 {
				canUpdate = false
				break
			}
		}

		if canUpdate {
			return version, nil
		}

		// If we can't update to this version due to dependencies, return an error
		return "", fmt.Errorf("cannot update to version %s: requires version %s", version, versionMeta.DependsOn[0])
	}

	return "", fmt.Errorf("no available versions to update to")
}

// GetUpdatePath returns an ordered list of versions needed to update from current to target version
func (self *Manager) GetUpdatePath(ctx context.Context, currentVersion, targetVersion string) ([]string, error) {
	// Ensure versions have v prefix
	if !strings.HasPrefix(currentVersion, "v") {
		currentVersion = "v" + currentVersion
	}
	if !strings.HasPrefix(targetVersion, "v") {
		targetVersion = "v" + targetVersion
	}

	// Validate versions
	if !semver.IsValid(currentVersion) || !semver.IsValid(targetVersion) {
		return []string{}, nil
	}

	// Get all tags from the repository
	tags, _, err := self.client.Repositories().ListTags(ctx, DefaultOwner, self.repo, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list tags: %w", err)
	}

	// Get published releases
	published, err := self.getPublishedReleases(ctx)
	if err != nil {
		return nil, err
	}

	// Get version metadata
	metadata, err := self.GetVersionMetadata(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get version metadata: %w", err)
	}

	// Filter and sort valid semver tags that have published releases and metadata
	validVersions := make([]string, 0, len(tags))
	for _, tag := range tags {
		version := tag.GetName()
		if semver.IsValid(version) && published[version] {
			// Only include versions that have metadata
			if _, hasMetadata := metadata[version]; hasMetadata {
				validVersions = append(validVersions, version)
			}
		}
	}

	// Sort versions
	sort.Slice(validVersions, func(i, j int) bool {
		return semver.Compare(validVersions[i], validVersions[j]) < 0
	})

	// Find the path from current to target version
	path := make([]string, 0)
	currentIdx := -1
	targetIdx := -1

	// Find indices of current and target versions
	for i, version := range validVersions {
		if version == currentVersion {
			currentIdx = i
		}
		if version == targetVersion {
			targetIdx = i
		}
	}

	// If either version not found or target is not newer, return empty path
	if currentIdx == -1 || targetIdx == -1 || targetIdx <= currentIdx {
		return []string{}, nil
	}

	// Build the path, respecting metadata rules
	for i := currentIdx + 1; i <= targetIdx; i++ {
		version := validVersions[i]
		meta := metadata[version]

		// Check if we can update to this version
		canUpdate := false
		if !meta.Breaking {
			// Non-breaking updates are always allowed
			canUpdate = true
		} else if len(meta.DependsOn) > 0 {
			// For breaking updates, check if current version is in dependencies
			for _, dep := range meta.DependsOn {
				if dep == currentVersion {
					canUpdate = true
					break
				}
			}
		}

		if canUpdate {
			path = append(path, version)
			currentVersion = version // Update current version for next iteration
		} else {
			// If we can't update to this version, we can't reach the target
			return []string{}, nil
		}
	}

	return path, nil
}
