package release

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/go-github/v69/github"
)

type Change struct {
	Message   string `json:"message"`
	CommitSHA string `json:"commit_sha,omitempty"`
	CommitURL string `json:"commit_url,omitempty"`
}

type VersionMetadata struct {
	Version   string   `json:"version"`
	DependsOn []string `json:"depends_on,omitempty"`
	Breaking  bool     `json:"breaking,omitempty"`
	Summary   string   `json:"summary,omitempty"`
	// Changes is parsed from the GitHub release body, never from metadata.json.
	Changes []Change `json:"changes,omitempty"`
}

type VersionMetadataMap map[string]VersionMetadata

// GetVersionMetadata reads MetadataPath through the contents API, which serves the branch head; the raw CDN can lag a new release by minutes.
func (self *Manager) GetVersionMetadata(ctx context.Context) (VersionMetadataMap, error) {
	file, _, _, err := self.client.Repositories().GetContents(ctx, self.owner, self.repo, MetadataPath, &github.RepositoryContentGetOptions{Ref: DefaultBranch})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch metadata: %w", err)
	}
	if file == nil {
		return nil, fmt.Errorf("failed to fetch metadata: %s is not a file", MetadataPath)
	}

	data, err := file.GetContent()
	if err != nil {
		return nil, fmt.Errorf("failed to read metadata: %w", err)
	}

	var metadata VersionMetadataMap
	if err := json.Unmarshal([]byte(data), &metadata); err != nil {
		return nil, fmt.Errorf("failed to parse metadata: %w", err)
	}

	return metadata, nil
}
