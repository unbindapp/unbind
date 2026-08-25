package release

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"path/filepath"
	"testing"

	"github.com/google/go-github/v69/github"
	"github.com/stretchr/testify/suite"
)

type mockGitHubClient struct {
	listReleasesFunc func(ctx context.Context, owner, repo string, opts *github.ListOptions) ([]*github.RepositoryRelease, *github.Response, error)
	getContentsFunc  func(ctx context.Context, owner, repo, path string, opts *github.RepositoryContentGetOptions) (*github.RepositoryContent, []*github.RepositoryContent, *github.Response, error)
}

func (m *mockGitHubClient) Repositories() RepositoriesServiceInterface {
	return &mockRepositoriesService{m}
}

type mockRepositoriesService struct {
	client *mockGitHubClient
}

func (m *mockRepositoriesService) ListReleases(ctx context.Context, owner, repo string, opts *github.ListOptions) ([]*github.RepositoryRelease, *github.Response, error) {
	return m.client.listReleasesFunc(ctx, owner, repo, opts)
}

func (m *mockRepositoriesService) GetContents(ctx context.Context, owner, repo, path string, opts *github.RepositoryContentGetOptions) (*github.RepositoryContent, []*github.RepositoryContent, *github.Response, error) {
	return m.client.getContentsFunc(ctx, owner, repo, path, opts)
}

func releasesFor(tags ...string) []*github.RepositoryRelease {
	releases := make([]*github.RepositoryRelease, 0, len(tags))
	for _, tag := range tags {
		releases = append(releases, &github.RepositoryRelease{TagName: new(tag)})
	}
	return releases
}

type ReleaseTestSuite struct {
	suite.Suite
	manager  *Manager
	server   *httptest.Server
	metadata VersionMetadataMap
}

func (s *ReleaseTestSuite) SetupTest() {
	// Create test metadata
	s.metadata = VersionMetadataMap{
		"v0.0.1": {
			Version:     "v0.0.1",
			Description: "Initial release",
			Breaking:    false,
		},
		"v0.0.2": {
			Version:     "v0.0.2",
			Description: "Feature update",
			Breaking:    false,
		},
		"v0.0.3": {
			Version:     "v0.0.3",
			Description: "Bug fix",
			Breaking:    false,
		},
		"v0.1.0": {
			Version:     "v0.1.0",
			Description: "Major update",
			Breaking:    true,
			DependsOn:   []string{"v0.0.3"},
		},
	}

	// Create test server
	s.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/unbindapp/unbind/master/deploy/releases/metadata.json" {
			data, _ := json.Marshal(s.metadata)
			w.Header().Set("Content-Type", "application/json")
			w.Write(data)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))

	mockClient := &mockGitHubClient{
		listReleasesFunc: func(ctx context.Context, owner, repo string, opts *github.ListOptions) ([]*github.RepositoryRelease, *github.Response, error) {
			return releasesFor("v0.0.1", "v0.0.2", "v0.0.3", "v0.1.0"), nil, nil
		},
	}

	s.manager = NewManager(mockClient, "")
	s.manager.metadataURL = s.server.URL + "/unbindapp/unbind/master/deploy/releases/metadata.json"
}

func (s *ReleaseTestSuite) TestNewManager() {
	m := NewManager(&mockGitHubClient{}, "")
	s.Equal("unbindapp", m.owner)
	s.Equal("unbind", m.repo)
	s.Equal("https://raw.githubusercontent.com/unbindapp/unbind/master/deploy/releases/metadata.json", m.metadataURL)

	m = NewManager(&mockGitHubClient{}, "fork")
	s.Equal("unbindapp", m.owner)
	s.Equal("fork", m.repo)

	m = NewManager(&mockGitHubClient{}, "someone/fork")
	s.Equal("someone", m.owner)
	s.Equal("fork", m.repo)
	s.Equal("https://raw.githubusercontent.com/someone/fork/master/deploy/releases/metadata.json", m.metadataURL)
}

func (s *ReleaseTestSuite) TestReleaseURL() {
	m := NewManager(&mockGitHubClient{}, "")
	s.Equal("https://github.com/unbindapp/unbind/releases/tag/v0.1.7", m.ReleaseURL("v0.1.7"))
	s.Equal("https://github.com/unbindapp/unbind/releases/tag/v0.1.7", m.ReleaseURL("0.1.7"))
	s.Equal("https://github.com/unbindapp/unbind/releases", m.ReleaseURL("development"))
	s.Equal("https://github.com/unbindapp/unbind/releases", m.ReleaseURL(""))

	m = NewManager(&mockGitHubClient{}, "someone/fork")
	s.Equal("https://github.com/someone/fork/releases/tag/v1.2.3", m.ReleaseURL("v1.2.3"))
}

func (s *ReleaseTestSuite) TearDownTest() {
	s.server.Close()
}

func (s *ReleaseTestSuite) TestAvailableUpdates() {
	tests := []struct {
		name           string
		currentVersion string
		expected       []string
		expectError    bool
	}{
		{
			name:           "from v0.0.1 - can update to non-breaking versions",
			currentVersion: "v0.0.1",
			expected:       []string{"v0.0.2", "v0.0.3"},
			expectError:    false,
		},
		{
			name:           "from v0.0.2 - can update to non-breaking version",
			currentVersion: "v0.0.2",
			expected:       []string{"v0.0.3"},
			expectError:    false,
		},
		{
			name:           "from v0.0.3 - can update to breaking version that depends on it",
			currentVersion: "v0.0.3",
			expected:       []string{"v0.1.0"},
			expectError:    false,
		},
		{
			name:           "from v0.1.0 - no updates available",
			currentVersion: "v0.1.0",
			expected:       []string{},
			expectError:    false,
		},
		{
			name:           "version without v prefix",
			currentVersion: "0.0.1",
			expected:       []string{"v0.0.2", "v0.0.3"},
			expectError:    false,
		},
		{
			name:           "invalid version",
			currentVersion: "invalid",
			expected:       []string{},
			expectError:    false,
		},
		{
			name:           "non-existent version",
			currentVersion: "v999.999.999",
			expected:       []string{},
			expectError:    false,
		},
	}

	for _, tt := range tests {
		s.Run(tt.name, func() {
			updates, err := s.manager.AvailableUpdates(context.Background(), tt.currentVersion)
			if tt.expectError {
				s.Error(err)
			} else {
				s.NoError(err)
				s.Equal(tt.expected, updates, "Expected updates for version %s to be %v, got %v", tt.currentVersion, tt.expected, updates)
			}
		})
	}
}

func (s *ReleaseTestSuite) TestGetLatestVersion() {
	tests := []struct {
		name         string
		mockReleases []*github.RepositoryRelease
		expected     string
		expectError  bool
	}{
		{
			name:         "published releases with metadata",
			mockReleases: releasesFor("v0.0.1", "v0.0.2", "v0.0.3", "v0.1.0"),
			expected:     "v0.1.0",
		},
		{
			name:         "no releases",
			mockReleases: []*github.RepositoryRelease{},
			expectError:  true,
		},
		{
			name:         "only invalid tags",
			mockReleases: releasesFor("invalid-tag"),
			expectError:  true,
		},
		{
			name:         "releases without metadata",
			mockReleases: releasesFor("v0.0.9", "v0.2.0"),
			expectError:  true,
		},
		{
			name:         "latest ignores releases without metadata",
			mockReleases: releasesFor("v0.0.1", "v0.0.2", "v0.2.0"),
			expected:     "v0.0.2",
		},
	}

	for _, tt := range tests {
		s.Run(tt.name, func() {
			s.manager.client.(*mockGitHubClient).listReleasesFunc = func(ctx context.Context, owner, repo string, opts *github.ListOptions) ([]*github.RepositoryRelease, *github.Response, error) {
				return tt.mockReleases, nil, nil
			}

			version, err := s.manager.GetLatestVersion(context.Background())
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

func (s *ReleaseTestSuite) TestGetUpdatePath() {
	tests := []struct {
		name           string
		currentVersion string
		targetVersion  string
		expected       []string
		expectError    bool
	}{
		{
			name:           "valid path",
			currentVersion: "v0.0.1",
			targetVersion:  "v0.0.3",
			expected:       []string{"v0.0.2", "v0.0.3"},
			expectError:    false,
		},
		{
			name:           "versions without v prefix",
			currentVersion: "0.0.1",
			targetVersion:  "0.0.3",
			expected:       []string{"v0.0.2", "v0.0.3"},
			expectError:    false,
		},
		{
			name:           "target version older than current",
			currentVersion: "v0.1.0",
			targetVersion:  "v0.0.1",
			expected:       []string{},
			expectError:    false,
		},
		{
			name:           "non-existent current version",
			currentVersion: "v999.999.999",
			targetVersion:  "v0.1.0",
			expected:       []string{},
			expectError:    false,
		},
		{
			name:           "non-existent target version",
			currentVersion: "v0.0.1",
			targetVersion:  "v999.999.999",
			expected:       []string{},
			expectError:    false,
		},
		{
			name:           "target version without release",
			currentVersion: "v0.0.1",
			targetVersion:  "v0.1.1",
			expected:       []string{},
			expectError:    false,
		},
		{
			name:           "path with dependencies",
			currentVersion: "v0.0.1",
			targetVersion:  "v0.1.0",
			expected:       []string{"v0.0.2", "v0.0.3", "v0.1.0"},
			expectError:    false,
		},
	}

	for _, tt := range tests {
		s.Run(tt.name, func() {
			s.manager.client.(*mockGitHubClient).listReleasesFunc = func(ctx context.Context, owner, repo string, opts *github.ListOptions) ([]*github.RepositoryRelease, *github.Response, error) {
				return releasesFor("v0.0.1", "v0.0.2", "v0.0.3", "v0.1.0"), nil, nil
			}

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

func (s *ReleaseTestSuite) TestDownloadVersionManifests() {
	files := map[string]string{
		"kustomization.yaml": "resources:\n  - role.yaml\n",
		"role.yaml":          "kind: Role\n",
	}
	fileServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, ok := files[path.Base(r.URL.Path)]
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Write([]byte(body))
	}))
	defer fileServer.Close()

	var requestedPath, requestedRef string
	s.manager.client.(*mockGitHubClient).getContentsFunc = func(ctx context.Context, owner, repo, p string, opts *github.RepositoryContentGetOptions) (*github.RepositoryContent, []*github.RepositoryContent, *github.Response, error) {
		requestedPath, requestedRef = p, opts.Ref
		entries := []*github.RepositoryContent{
			{Type: new("dir"), Name: new("nested")},
		}
		for name := range files {
			entries = append(entries, &github.RepositoryContent{
				Type:        new("file"),
				Name:        new(name),
				DownloadURL: new(fileServer.URL + "/" + name),
			})
		}
		return nil, entries, nil, nil
	}

	dir := s.T().TempDir()
	found, err := s.manager.DownloadVersionManifests(context.Background(), "v0.1.0", dir)
	s.NoError(err)
	s.True(found)
	s.Equal("deploy/releases/v0.1.0", requestedPath)
	s.Equal("v0.1.0", requestedRef)
	for name, body := range files {
		data, err := os.ReadFile(filepath.Join(dir, name))
		s.NoError(err)
		s.Equal(body, string(data))
	}
	s.NoFileExists(filepath.Join(dir, "nested"))
}

func (s *ReleaseTestSuite) TestDownloadVersionManifests_Missing() {
	s.manager.client.(*mockGitHubClient).getContentsFunc = func(ctx context.Context, owner, repo, p string, opts *github.RepositoryContentGetOptions) (*github.RepositoryContent, []*github.RepositoryContent, *github.Response, error) {
		return nil, nil, &github.Response{Response: &http.Response{StatusCode: http.StatusNotFound}}, errors.New("404 Not Found")
	}

	found, err := s.manager.DownloadVersionManifests(context.Background(), "v0.1.0", s.T().TempDir())
	s.NoError(err)
	s.False(found)
}

func (s *ReleaseTestSuite) TestDownloadVersionManifests_NoKustomization() {
	s.manager.client.(*mockGitHubClient).getContentsFunc = func(ctx context.Context, owner, repo, p string, opts *github.RepositoryContentGetOptions) (*github.RepositoryContent, []*github.RepositoryContent, *github.Response, error) {
		return nil, []*github.RepositoryContent{{Type: new("dir"), Name: new("nested")}}, nil, nil
	}

	found, err := s.manager.DownloadVersionManifests(context.Background(), "v0.1.0", s.T().TempDir())
	s.NoError(err)
	s.False(found)
}

func TestReleaseSuite(t *testing.T) {
	suite.Run(t, new(ReleaseTestSuite))
}
