package updater

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
	mocks_k8s "github.com/unbindapp/unbind-api/mocks/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/pkg/release"
)

// MockReleaseManager is a mock for the release manager
type MockReleaseManager struct {
	mock.Mock
}

func (m *MockReleaseManager) AvailableUpdates(ctx context.Context, currentVersion string) ([]release.VersionMetadata, error) {
	args := m.Called(ctx, currentVersion)
	return args.Get(0).([]release.VersionMetadata), args.Error(1)
}

func (m *MockReleaseManager) GetLatestVersion(ctx context.Context) (string, error) {
	args := m.Called(ctx)
	return args.String(0), args.Error(1)
}

func (m *MockReleaseManager) GetUpdatePath(ctx context.Context, currentVersion, targetVersion string) ([]string, error) {
	args := m.Called(ctx, currentVersion, targetVersion)
	return args.Get(0).([]string), args.Error(1)
}

func (m *MockReleaseManager) DownloadVersionManifests(ctx context.Context, version, destDir string) (bool, error) {
	args := m.Called(ctx, version, destDir)
	return args.Bool(0), args.Error(1)
}

func (m *MockReleaseManager) ReleaseURL(version string) string {
	args := m.Called(version)
	return args.String(0)
}

// UpdaterTestSuite defines the test suite for Updater
type UpdaterTestSuite struct {
	suite.Suite
	ctx                context.Context
	cancel             context.CancelFunc
	cfg                *config.Config
	mockK8sClient      *mocks_k8s.KubeClientMock
	mockReleaseManager *MockReleaseManager
	miniRedis          *miniredis.Miniredis
	redisClient        *redis.Client
}

func (suite *UpdaterTestSuite) SetupSuite() {
	suite.ctx, suite.cancel = context.WithTimeout(context.Background(), 30*time.Second)

	// Setup configuration
	suite.cfg = &config.Config{
		SystemNamespace: "default",
	}
}

func (suite *UpdaterTestSuite) TearDownSuite() {
	if suite.cancel != nil {
		suite.cancel()
	}
}

func (suite *UpdaterTestSuite) SetupTest() {
	suite.mockK8sClient = &mocks_k8s.KubeClientMock{}
	suite.mockReleaseManager = &MockReleaseManager{}

	var err error
	suite.miniRedis, err = miniredis.Run()
	suite.Require().NoError(err)
	suite.redisClient = redis.NewClient(&redis.Options{
		Addr: suite.miniRedis.Addr(),
	})
}

func (suite *UpdaterTestSuite) TearDownTest() {
	if suite.redisClient != nil {
		suite.redisClient.Close()
	}
	if suite.miniRedis != nil {
		suite.miniRedis.Close()
	}
}

// Test New function
func (suite *UpdaterTestSuite) TestNew() {
	currentVersion := "v1.0.0"
	updater := New(suite.cfg, currentVersion, suite.mockK8sClient, suite.redisClient)

	suite.NotNil(updater)
	suite.Equal(suite.cfg, updater.cfg)
	suite.Equal(currentVersion, updater.CurrentVersion)
	suite.Equal(suite.mockK8sClient, updater.k8sClient)
	suite.NotNil(updater.releaseManager)
	suite.NotNil(updater.httpClient)
	suite.NotNil(updater.redisCache)
}

// Test NewWithReleaseManager function
func (suite *UpdaterTestSuite) TestNewWithReleaseManager() {
	currentVersion := "v1.0.0"
	updater := NewWithReleaseManager(suite.cfg, currentVersion, suite.mockK8sClient, suite.redisClient, suite.mockReleaseManager)

	suite.NotNil(updater)
	suite.Equal(suite.cfg, updater.cfg)
	suite.Equal(currentVersion, updater.CurrentVersion)
	suite.Equal(suite.mockK8sClient, updater.k8sClient)
	suite.Equal(suite.mockReleaseManager, updater.releaseManager)
	suite.NotNil(updater.httpClient)
	suite.NotNil(updater.redisCache)
}

// Test CheckForUpdates method
func (suite *UpdaterTestSuite) TestCheckForUpdates_Success() {
	updater := NewWithReleaseManager(suite.cfg, "v1.0.0", suite.mockK8sClient, suite.redisClient, suite.mockReleaseManager)
	expectedUpdates := []release.VersionMetadata{
		{Version: "v1.1.0", Description: "first"},
		{Version: "v1.2.0", ReleaseNotes: "notes"},
	}
	suite.mockReleaseManager.On("AvailableUpdates", suite.ctx, "v1.0.0").Return(expectedUpdates, nil)

	updates, err := updater.CheckForUpdates(suite.ctx)

	suite.NoError(err)
	suite.Equal(expectedUpdates, updates)
	suite.mockReleaseManager.AssertExpectations(suite.T())
}

func (suite *UpdaterTestSuite) TestCheckForUpdates_Error() {
	updater := NewWithReleaseManager(suite.cfg, "v1.0.0", suite.mockK8sClient, suite.redisClient, suite.mockReleaseManager)
	expectedError := errors.New("GitHub API error")
	suite.mockReleaseManager.On("AvailableUpdates", suite.ctx, "v1.0.0").Return([]release.VersionMetadata{}, expectedError)

	updates, err := updater.CheckForUpdates(suite.ctx)

	suite.NoError(err) // Should not error, just return empty slice
	suite.Equal([]release.VersionMetadata{}, updates)
	suite.mockReleaseManager.AssertExpectations(suite.T())
}

func (suite *UpdaterTestSuite) TestCheckForUpdates_IgnoresCacheFromOtherVersion() {
	oldUpdater := NewWithReleaseManager(suite.cfg, "v1.0.0", suite.mockK8sClient, suite.redisClient, suite.mockReleaseManager)
	suite.mockReleaseManager.On("AvailableUpdates", suite.ctx, "v1.0.0").Return([]release.VersionMetadata{{Version: "v1.1.0"}}, nil).Once()

	updates, err := oldUpdater.CheckForUpdates(suite.ctx)
	suite.NoError(err)
	suite.Len(updates, 1)

	// A binary on v1.1.0 must not serve the v1.0.0 binary's cached list, which
	// contains the version it already runs.
	newUpdater := NewWithReleaseManager(suite.cfg, "v1.1.0", suite.mockK8sClient, suite.redisClient, suite.mockReleaseManager)
	suite.mockReleaseManager.On("AvailableUpdates", suite.ctx, "v1.1.0").Return([]release.VersionMetadata{}, nil).Once()

	updates, err = newUpdater.CheckForUpdates(suite.ctx)

	suite.NoError(err)
	suite.Empty(updates)
	suite.mockReleaseManager.AssertExpectations(suite.T())
}

func (suite *UpdaterTestSuite) TestCheckForUpdates_FiltersCurrentAndOlderVersions() {
	updater := NewWithReleaseManager(suite.cfg, "v1.1.0", suite.mockK8sClient, suite.redisClient, suite.mockReleaseManager)
	suite.mockReleaseManager.On("AvailableUpdates", suite.ctx, "v1.1.0").Return([]release.VersionMetadata{
		{Version: "v1.0.0"},
		{Version: "v1.1.0"},
		{Version: "v1.2.0"},
	}, nil)

	updates, err := updater.CheckForUpdates(suite.ctx)

	suite.NoError(err)
	suite.Equal([]release.VersionMetadata{{Version: "v1.2.0"}}, updates)
}

func (suite *UpdaterTestSuite) TestCheckForUpdates_CacheExpires() {
	updater := NewWithReleaseManager(suite.cfg, "v1.0.0", suite.mockK8sClient, suite.redisClient, suite.mockReleaseManager)
	suite.mockReleaseManager.On("AvailableUpdates", suite.ctx, "v1.0.0").Return([]release.VersionMetadata{{Version: "v1.1.0"}}, nil)

	_, err := updater.CheckForUpdates(suite.ctx)
	suite.NoError(err)

	ttl, err := suite.redisClient.TTL(suite.ctx, "unbind-updater:updates").Result()
	suite.NoError(err)
	suite.Greater(ttl, time.Duration(0))
	suite.LessOrEqual(ttl, updatesCacheTTL)
}

func (suite *UpdaterTestSuite) TestClearUpdatesCache() {
	updater := NewWithReleaseManager(suite.cfg, "v1.0.0", suite.mockK8sClient, suite.redisClient, suite.mockReleaseManager)
	suite.mockReleaseManager.On("AvailableUpdates", suite.ctx, "v1.0.0").Return([]release.VersionMetadata{{Version: "v1.1.0"}}, nil).Twice()

	_, err := updater.CheckForUpdates(suite.ctx)
	suite.NoError(err)

	suite.NoError(updater.ClearUpdatesCache(suite.ctx))

	// With the cache cleared, the next check must hit the release manager again.
	_, err = updater.CheckForUpdates(suite.ctx)
	suite.NoError(err)
	suite.mockReleaseManager.AssertExpectations(suite.T())
}

// Test GetLatestVersion method
func (suite *UpdaterTestSuite) TestGetLatestVersion_Success() {
	updater := NewWithReleaseManager(suite.cfg, "v1.0.0", suite.mockK8sClient, suite.redisClient, suite.mockReleaseManager)
	expectedVersion := "v1.2.0"
	suite.mockReleaseManager.On("GetLatestVersion", suite.ctx).Return(expectedVersion, nil)

	version, err := updater.GetLatestVersion(suite.ctx)

	suite.NoError(err)
	suite.Equal(expectedVersion, version)
	suite.mockReleaseManager.AssertExpectations(suite.T())
}

// Test CheckUpdateComplete method (this doesn't depend on release manager)
func (suite *UpdaterTestSuite) TestCheckUpdateComplete_Success() {
	updater := New(suite.cfg, "v1.2.0", suite.mockK8sClient, suite.redisClient)
	version := "v1.2.0"

	suite.mockK8sClient.On("CheckDeploymentsReady", suite.ctx, version).Return(true, nil)

	ready, err := updater.CheckUpdateComplete(suite.ctx, version)

	suite.NoError(err)
	suite.True(ready)
	suite.mockK8sClient.AssertExpectations(suite.T())
}

// A binary still on the old version must never report an update as complete,
// even if the cluster looks fully rolled out.
func (suite *UpdaterTestSuite) TestCheckUpdateComplete_OldBinaryNeverComplete() {
	updater := New(suite.cfg, "v1.0.0", suite.mockK8sClient, suite.redisClient)

	ready, err := updater.CheckUpdateComplete(suite.ctx, "v1.2.0")

	suite.NoError(err)
	suite.False(ready)
	suite.mockK8sClient.AssertNotCalled(suite.T(), "CheckDeploymentsReady", mock.Anything, mock.Anything)
}

func (suite *UpdaterTestSuite) TestCheckUpdateComplete_Error() {
	updater := New(suite.cfg, "v1.2.0", suite.mockK8sClient, suite.redisClient)
	version := "v1.2.0"
	expectedError := errors.New("Kubernetes API error")

	suite.mockK8sClient.On("CheckDeploymentsReady", suite.ctx, version).Return(false, expectedError)

	ready, err := updater.CheckUpdateComplete(suite.ctx, version)

	suite.Error(err)
	suite.False(ready)
	suite.mockK8sClient.AssertExpectations(suite.T())
}

func (suite *UpdaterTestSuite) writeManifests(files map[string]string) func(mock.Arguments) {
	return func(args mock.Arguments) {
		dir := args.String(2)
		for name, content := range files {
			suite.NoError(os.WriteFile(filepath.Join(dir, name), []byte(content), 0644))
		}
	}
}

func (suite *UpdaterTestSuite) TestUpdateToVersion_RunsManifestApplyJob() {
	updater := NewWithReleaseManager(suite.cfg, "v1.0.0", suite.mockK8sClient, suite.redisClient, suite.mockReleaseManager)

	suite.mockReleaseManager.On("GetUpdatePath", suite.ctx, "v1.0.0", "v1.1.0").Return([]string{"v1.1.0"}, nil)
	suite.mockReleaseManager.On("DownloadVersionManifests", suite.ctx, "v1.1.0", mock.AnythingOfType("string")).
		Run(suite.writeManifests(map[string]string{
			"kustomization.yaml": "resources:\n  - role.yaml\n",
			"role.yaml":          "apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: test-role\n",
		})).
		Return(true, nil)
	suite.mockK8sClient.On("RunManifestApplyJob", suite.ctx, "v1.1.0", "ghcr.io/unbindapp/unbind:v1.0.0", mock.Anything).Return(nil)
	suite.mockK8sClient.On("UpdateDeploymentImages", suite.ctx, "v1.1.0").Return(nil)

	suite.NoError(updater.UpdateToVersion(suite.ctx, "v1.1.0"))
	suite.mockK8sClient.AssertExpectations(suite.T())
}

func (suite *UpdaterTestSuite) TestUpdateToVersion_JobImageOverride() {
	cfg := &config.Config{SystemNamespace: "default", UpdateJobImage: "example.com/unbind:test"}
	updater := NewWithReleaseManager(cfg, "v1.0.0", suite.mockK8sClient, suite.redisClient, suite.mockReleaseManager)

	suite.mockReleaseManager.On("GetUpdatePath", suite.ctx, "v1.0.0", "v1.1.0").Return([]string{"v1.1.0"}, nil)
	suite.mockReleaseManager.On("DownloadVersionManifests", suite.ctx, "v1.1.0", mock.AnythingOfType("string")).
		Run(suite.writeManifests(map[string]string{
			"kustomization.yaml": "resources:\n  - role.yaml\n",
			"role.yaml":          "apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: test-role\n",
		})).
		Return(true, nil)
	suite.mockK8sClient.On("RunManifestApplyJob", suite.ctx, "v1.1.0", "example.com/unbind:test", mock.Anything).Return(nil)
	suite.mockK8sClient.On("UpdateDeploymentImages", suite.ctx, "v1.1.0").Return(nil)

	suite.NoError(updater.UpdateToVersion(suite.ctx, "v1.1.0"))
	suite.mockK8sClient.AssertExpectations(suite.T())
}

func (suite *UpdaterTestSuite) TestUpdateToVersion_DefaultsNamespaceKeepsExplicit() {
	updater := NewWithReleaseManager(suite.cfg, "v1.0.0", suite.mockK8sClient, suite.redisClient, suite.mockReleaseManager)

	suite.mockReleaseManager.On("GetUpdatePath", suite.ctx, "v1.0.0", "v1.1.0").Return([]string{"v1.1.0"}, nil)
	suite.mockReleaseManager.On("DownloadVersionManifests", suite.ctx, "v1.1.0", mock.AnythingOfType("string")).
		Run(suite.writeManifests(map[string]string{
			"kustomization.yaml": "resources:\n  - configmap.yaml\n  - recurringjob.yaml\n",
			"configmap.yaml":     "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: test-cm\n",
			"recurringjob.yaml":  "apiVersion: longhorn.io/v1beta2\nkind: RecurringJob\nmetadata:\n  name: test-job\n  namespace: longhorn-system\nspec:\n  task: snapshot-cleanup\n",
		})).
		Return(true, nil)

	var applied []byte
	suite.mockK8sClient.On("RunManifestApplyJob", suite.ctx, "v1.1.0", mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) { applied = args.Get(3).([]byte) }).
		Return(nil)
	suite.mockK8sClient.On("UpdateDeploymentImages", suite.ctx, "v1.1.0").Return(nil)

	suite.NoError(updater.UpdateToVersion(suite.ctx, "v1.1.0"))
	suite.Contains(string(applied), "namespace: default")
	suite.Contains(string(applied), "namespace: longhorn-system")
	suite.mockK8sClient.AssertExpectations(suite.T())
}

func (suite *UpdaterTestSuite) TestUpdateToVersion_EmptyKustomizationSkipsJob() {
	updater := NewWithReleaseManager(suite.cfg, "v1.0.0", suite.mockK8sClient, suite.redisClient, suite.mockReleaseManager)

	suite.mockReleaseManager.On("GetUpdatePath", suite.ctx, "v1.0.0", "v1.1.0").Return([]string{"v1.1.0"}, nil)
	suite.mockReleaseManager.On("DownloadVersionManifests", suite.ctx, "v1.1.0", mock.AnythingOfType("string")).
		Run(suite.writeManifests(map[string]string{"kustomization.yaml": ""})).
		Return(true, nil)
	suite.mockK8sClient.On("UpdateDeploymentImages", suite.ctx, "v1.1.0").Return(nil)

	suite.NoError(updater.UpdateToVersion(suite.ctx, "v1.1.0"))
	suite.mockK8sClient.AssertNotCalled(suite.T(), "RunManifestApplyJob", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	suite.mockK8sClient.AssertExpectations(suite.T())
}

func (suite *UpdaterTestSuite) TestUpdateToVersion_JobFailureRollsBack() {
	updater := NewWithReleaseManager(suite.cfg, "v1.0.0", suite.mockK8sClient, suite.redisClient, suite.mockReleaseManager)

	suite.mockReleaseManager.On("GetUpdatePath", suite.ctx, "v1.0.0", "v1.1.0").Return([]string{"v1.1.0"}, nil)
	suite.mockReleaseManager.On("DownloadVersionManifests", suite.ctx, "v1.1.0", mock.AnythingOfType("string")).
		Run(suite.writeManifests(map[string]string{
			"kustomization.yaml": "resources:\n  - role.yaml\n",
			"role.yaml":          "apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: test-role\n",
		})).
		Return(true, nil)
	suite.mockK8sClient.On("RunManifestApplyJob", suite.ctx, "v1.1.0", mock.Anything, mock.Anything).Return(errors.New("job failed"))
	suite.mockK8sClient.On("UpdateDeploymentImages", suite.ctx, "v1.0.0").Return(nil)

	err := updater.UpdateToVersion(suite.ctx, "v1.1.0")

	suite.ErrorContains(err, "failed to apply kustomize manifests for version v1.1.0")
	suite.mockK8sClient.AssertNotCalled(suite.T(), "UpdateDeploymentImages", suite.ctx, "v1.1.0")
	suite.mockK8sClient.AssertExpectations(suite.T())
}

// Test that the release manager is properly initialized
func (suite *UpdaterTestSuite) TestNew_ReleaseManagerInitialization() {
	updater := New(suite.cfg, "v1.0.0", suite.mockK8sClient, suite.redisClient)

	suite.NotNil(updater.releaseManager)
}

// Test interface implementation
func (suite *UpdaterTestSuite) TestMockImplementsInterface() {
	var _ release.ManagerInterface = suite.mockReleaseManager
}

func TestUpdaterTestSuite(t *testing.T) {
	suite.Run(t, new(UpdaterTestSuite))
}
