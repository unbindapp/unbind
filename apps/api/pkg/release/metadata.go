package release

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"golang.org/x/mod/semver"
)

type VersionMetadata struct {
	Version      string   `json:"version"`
	DependsOn    []string `json:"depends_on,omitempty"`
	RequiredBy   []string `json:"required_by,omitempty"`
	Breaking     bool     `json:"breaking,omitempty"`
	Description  string   `json:"description,omitempty"`
	ReleaseNotes string   `json:"release_notes,omitempty"`
}

type VersionMetadataMap map[string]VersionMetadata

func (self *Manager) GetVersionMetadata(ctx context.Context) (VersionMetadataMap, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, self.metadataURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch metadata: %w", err)
	}
	resp, err := self.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch metadata: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch metadata: status code %d", resp.StatusCode)
	}

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

// GetNextAvailableVersion returns the first update reachable from currentVersion.
func (self *Manager) GetNextAvailableVersion(ctx context.Context, currentVersion string) (string, error) {
	currentVersion = normalizeVersion(currentVersion)

	updates, err := self.AvailableUpdates(ctx, currentVersion)
	if err != nil {
		return "", err
	}
	if len(updates) == 0 {
		return "", fmt.Errorf("no available versions to update to")
	}

	metadata, err := self.GetVersionMetadata(ctx)
	if err != nil {
		return "", err
	}

	next := updates[0]
	for _, dep := range metadata[next].DependsOn {
		if semver.Compare(dep, currentVersion) > 0 {
			return "", fmt.Errorf("cannot update to version %s: requires version %s", next, dep)
		}
	}

	return next, nil
}
