package release

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/go-github/v69/github"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

type MetadataTestSuite struct {
	suite.Suite
	manager  *Manager
	server   *httptest.Server
	metadata VersionMetadataMap
}

func (s *MetadataTestSuite) SetupTest() {
	// Create test metadata
	s.metadata = VersionMetadataMap{
		"v0.1.0": {
			Version:     "v0.1.0",
			Description: "Initial release",
			Breaking:    false,
		},
		"v0.2.0": {
			Version:     "v0.2.0",
			Description: "Feature update",
			Breaking:    false,
		},
		"v0.3.0": {
			Version:     "v0.3.0",
			Description: "Database schema update",
			Breaking:    true,
			DependsOn:   []string{"v0.2.0"},
		},
		"v0.4.0": {
			Version:     "v0.4.0",
			Description: "Major feature update",
			Breaking:    true,
			DependsOn:   []string{"v0.3.0"},
		},
	}

	// Create test server
	s.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/unbindapp/unbind-releases/master/metadata.json" {
			data, _ := json.Marshal(s.metadata)
			w.Header().Set("Content-Type", "application/json")
			w.Write(data)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))

	// Create mock client that returns our test tags
	mockClient := &mockGitHubClient{
		listTagsFunc: func(ctx context.Context, owner, repo string, opts *github.ListOptions) ([]*github.RepositoryTag, *github.Response, error) {
			return []*github.RepositoryTag{
				{Name: utils.ToPtr("v0.1.0")},
				{Name: utils.ToPtr("v0.2.0")},
				{Name: utils.ToPtr("v0.3.0")},
				{Name: utils.ToPtr("v0.4.0")},
			}, nil, nil
		},
		listReleasesFunc: func(ctx context.Context, owner, repo string, opts *github.ListOptions) ([]*github.RepositoryRelease, *github.Response, error) {
			return []*github.RepositoryRelease{
				{TagName: utils.ToPtr("v0.1.0")},
				{TagName: utils.ToPtr("v0.2.0")},
				{TagName: utils.ToPtr("v0.3.0")},
				{TagName: utils.ToPtr("v0.4.0")},
			}, nil, nil
		},
	}

	// Create manager with mock client and override the metadata URL
	s.manager = NewManager(mockClient, "unbindapp/unbind-releases")
	s.manager.metadataURL = s.server.URL + "/unbindapp/unbind-releases/master/metadata.json"
}

func (s *MetadataTestSuite) TearDownTest() {
	s.server.Close()
}

func (s *MetadataTestSuite) TestGetVersionMetadata() {
	metadata, err := s.manager.GetVersionMetadata(context.Background())
	s.NoError(err)
	s.Equal(s.metadata, metadata)
}

func (s *MetadataTestSuite) TestGetNextAvailableVersion() {
	tests := []struct {
		name           string
		currentVersion string
		expected       string
		expectError    bool
	}{
		{
			name:           "can update to next version",
			currentVersion: "v0.1.0",
			expected:       "v0.2.0",
			expectError:    false,
		},
		{
			name:           "can update to version with satisfied dependencies",
			currentVersion: "v0.2.0",
			expected:       "v0.3.0",
			expectError:    false,
		},
		{
			name:           "can update to version with multiple satisfied dependencies",
			currentVersion: "v0.3.0",
			expected:       "v0.4.0",
			expectError:    false,
		},
		{
			name:           "latest version",
			currentVersion: "v0.4.0",
			expected:       "",
			expectError:    true,
		},
	}

	for _, tt := range tests {
		s.Run(tt.name, func() {
			version, err := s.manager.GetNextAvailableVersion(context.Background(), tt.currentVersion)
			if tt.expectError {
				s.Error(err)
				s.Empty(version)
			} else {
				s.NoError(err)
				s.Equal(tt.expected, version)
			}
		})
	}
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
