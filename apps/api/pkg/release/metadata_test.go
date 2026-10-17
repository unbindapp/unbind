package release

import (
	"context"
	"errors"
	"testing"

	"github.com/google/go-github/v69/github"
	"github.com/stretchr/testify/suite"
)

type MetadataTestSuite struct {
	suite.Suite
	manager  *Manager
	metadata VersionMetadataMap
}

func (s *MetadataTestSuite) SetupTest() {
	// Create test metadata
	s.metadata = VersionMetadataMap{
		"v0.1.0": {
			Version:  "v0.1.0",
			Summary:  "Initial release",
			Breaking: false,
		},
		"v0.2.0": {
			Version:  "v0.2.0",
			Summary:  "Feature update",
			Breaking: false,
		},
		"v0.3.0": {
			Version:   "v0.3.0",
			Summary:   "Database schema update",
			Breaking:  true,
			DependsOn: []string{"v0.2.0"},
		},
		"v0.4.0": {
			Version:   "v0.4.0",
			Summary:   "Major feature update",
			Breaking:  true,
			DependsOn: []string{"v0.3.0"},
		},
	}

	mockClient := &mockGitHubClient{
		getContentsFunc: metadataContents(s.metadata),
		listReleasesFunc: func(ctx context.Context, owner, repo string, opts *github.ListOptions) ([]*github.RepositoryRelease, *github.Response, error) {
			return releasesFor("v0.1.0", "v0.2.0", "v0.3.0", "v0.4.0"), nil, nil
		},
	}

	s.manager = NewManager(mockClient, "")
}

func (s *MetadataTestSuite) TestGetVersionMetadata() {
	metadata, err := s.manager.GetVersionMetadata(context.Background())
	s.NoError(err)
	s.Equal(s.metadata, metadata)
}

func (s *MetadataTestSuite) TestGetVersionMetadata_FetchError() {
	s.manager.client.(*mockGitHubClient).getContentsFunc = func(ctx context.Context, owner, repo, path string, opts *github.RepositoryContentGetOptions) (*github.RepositoryContent, []*github.RepositoryContent, *github.Response, error) {
		return nil, nil, nil, errors.New("rate limited")
	}

	_, err := s.manager.GetVersionMetadata(context.Background())
	s.ErrorContains(err, "rate limited")
}

func (s *MetadataTestSuite) TestGetVersionMetadata_Directory() {
	s.manager.client.(*mockGitHubClient).getContentsFunc = func(ctx context.Context, owner, repo, path string, opts *github.RepositoryContentGetOptions) (*github.RepositoryContent, []*github.RepositoryContent, *github.Response, error) {
		return nil, []*github.RepositoryContent{}, nil, nil
	}

	_, err := s.manager.GetVersionMetadata(context.Background())
	s.Error(err)
}

func (s *MetadataTestSuite) TestGetVersionMetadata_InvalidJSON() {
	s.manager.client.(*mockGitHubClient).getContentsFunc = func(ctx context.Context, owner, repo, path string, opts *github.RepositoryContentGetOptions) (*github.RepositoryContent, []*github.RepositoryContent, *github.Response, error) {
		return &github.RepositoryContent{Content: new("{not json")}, nil, nil, nil
	}

	_, err := s.manager.GetVersionMetadata(context.Background())
	s.ErrorContains(err, "failed to parse metadata")
}

func (s *MetadataTestSuite) TestGetUpdatePath() {
	tests := []struct {
		name           string
		currentVersion string
		targetVersion  string
		expected       []string
		expectError    bool
	}{
		{
			name:           "direct update path",
			currentVersion: "v0.1.0",
			targetVersion:  "v0.2.0",
			expected:       []string{"v0.2.0"},
			expectError:    false,
		},
		{
			name:           "path with dependencies",
			currentVersion: "v0.1.0",
			targetVersion:  "v0.3.0",
			expected:       []string{"v0.2.0", "v0.3.0"},
			expectError:    false,
		},
		{
			name:           "path with multiple dependencies",
			currentVersion: "v0.1.0",
			targetVersion:  "v0.4.0",
			expected:       []string{"v0.2.0", "v0.3.0", "v0.4.0"},
			expectError:    false,
		},
		{
			name:           "invalid target version",
			currentVersion: "v0.1.0",
			targetVersion:  "v999.999.999",
			expected:       []string{},
			expectError:    false,
		},
		{
			name:           "target version older than current",
			currentVersion: "v0.3.0",
			targetVersion:  "v0.1.0",
			expected:       []string{},
			expectError:    false,
		},
	}

	for _, tt := range tests {
		s.Run(tt.name, func() {
			path, err := s.manager.GetUpdatePath(context.Background(), tt.currentVersion, tt.targetVersion)
			if tt.expectError {
				s.Error(err)
			} else {
				s.NoError(err)
				s.Equal(tt.expected, path)
			}
		})
	}
}

func TestMetadataSuite(t *testing.T) {
	suite.Run(t, new(MetadataTestSuite))
}
