package release

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type VersionMetadata struct {
	Version      string   `json:"version"`
	DependsOn    []string `json:"depends_on,omitempty"`
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
