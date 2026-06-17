package updater

import (
	"context"
	"errors"
	"testing"
	"time"

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

func (m *MockReleaseManager) AvailableUpdates(ctx context.Context, currentVersion string) ([]string, error) {
	args := m.Called(ctx, currentVersion)
	return args.Get(0).([]string), args.Error(1)
}

func (m *MockReleaseManager) GetLatestVersion(ctx context.Context) (string, error) {
	args := m.Called(ctx)
	return args.String(0), args.Error(1)
}

func (m *MockReleaseManager) GetUpdatePath(ctx context.Context, currentVersion, targetVersion string) ([]string, error) {
	args := m.Called(ctx, currentVersion, targetVersion)
	return args.Get(0).([]string), args.Error(1)
}

func (m *MockReleaseManager) GetNextAvailableVersion(ctx context.Context, currentVersion string) (string, error) {
	args := m.Called(ctx, currentVersion)
	return args.String(0), args.Error(1)
}

func (m *MockReleaseManager) GetRepositoryInfo() (string, string) {
	args := m.Called()
	return args.String(0), args.String(1)
}

// MockRedisClient is a mock for Redis client
type MockRedisClient struct {
	mock.Mock
}

func (m *MockRedisClient) Get(ctx context.Context, key string) *redis.StringCmd {
	args := m.Called(ctx, key)
	return args.Get(0).(*redis.StringCmd)
}

func (m *MockRedisClient) Set(ctx context.Context, key string, value any, expiration time.Duration) *redis.StatusCmd {
	args := m.Called(ctx, key, value, expiration)
	return args.Get(0).(*redis.StatusCmd)
}

func (m *MockRedisClient) Del(ctx context.Context, keys ...string) *redis.IntCmd {
	args := m.Called(ctx, keys)
	return args.Get(0).(*redis.IntCmd)
}

// UpdaterTestSuite defines the test suite for Updater
type UpdaterTestSuite struct {
	suite.Suite
	ctx                context.Context
	cancel             context.CancelFunc
	cfg                *config.Config
	mockK8sClient      *mocks_k8s.KubeClientMock
	mockReleaseManager *MockReleaseManager
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
	// Setup mocks
	suite.mockK8sClient = &mocks_k8s.KubeClientMock{}
	suite.mockReleaseManager = &MockReleaseManager{}

	// Create a real Redis client for testing (you might want to use a test instance)
	suite.redisClient = redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15, // Use a test database
	})

	// Reset mock expectations
	suite.mockK8sClient.ExpectedCalls = nil
	suite.mockReleaseManager.ExpectedCalls = nil

	// Clear test cache
	suite.redisClient.FlushDB(suite.ctx)
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
	expectedUpdates := []string{"v1.1.0", "v1.2.0"}
	suite.mockReleaseManager.On("AvailableUpdates", suite.ctx, "v1.0.0").Return(expectedUpdates, nil)

	updates, err := updater.CheckForUpdates(suite.ctx)

	suite.NoError(err)
	suite.Equal(expectedUpdates, updates)
	suite.mockReleaseManager.AssertExpectations(suite.T())
}

func (suite *UpdaterTestSuite) TestCheckForUpdates_Error() {
	updater := NewWithReleaseManager(suite.cfg, "v1.0.0", suite.mockK8sClient, suite.redisClient, suite.mockReleaseManager)
	expectedError := errors.New("GitHub API error")
	suite.mockReleaseManager.On("AvailableUpdates", suite.ctx, "v1.0.0").Return([]string{}, expectedError)

	updates, err := updater.CheckForUpdates(suite.ctx)

	suite.NoError(err) // Should not error, just return empty slice
	suite.Equal([]string{}, updates)
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

// Test CheckDeploymentsReady method (this doesn't depend on release manager)
func (suite *UpdaterTestSuite) TestCheckDeploymentsReady_Success() {
	updater := New(suite.cfg, "v1.0.0", suite.mockK8sClient, suite.redisClient)
	version := "v1.2.0"

	suite.mockK8sClient.On("CheckDeploymentsReady", suite.ctx, version).Return(true, nil)

	ready, err := updater.CheckDeploymentsReady(suite.ctx, version)

	suite.NoError(err)
	suite.True(ready)
	suite.mockK8sClient.AssertExpectations(suite.T())
}

func (suite *UpdaterTestSuite) TestCheckDeploymentsReady_Error() {
	updater := New(suite.cfg, "v1.0.0", suite.mockK8sClient, suite.redisClient)
	version := "v1.2.0"
	expectedError := errors.New("Kubernetes API error")

	suite.mockK8sClient.On("CheckDeploymentsReady", suite.ctx, version).Return(false, expectedError)

	ready, err := updater.CheckDeploymentsReady(suite.ctx, version)

	suite.Error(err)
	suite.False(ready)
	suite.mockK8sClient.AssertExpectations(suite.T())
}

// Test that the release manager is properly initialized
func (suite *UpdaterTestSuite) TestNew_ReleaseManagerInitialization() {
	updater := New(suite.cfg, "v1.0.0", suite.mockK8sClient, suite.redisClient)

	suite.NotNil(updater.releaseManager)
	// Test that we can call GetRepositoryInfo (this doesn't require network access)
	owner, repo := updater.releaseManager.GetRepositoryInfo()
	suite.NotEmpty(owner)
	suite.NotEmpty(repo)
}

// Test interface implementation
func (suite *UpdaterTestSuite) TestMockImplementsInterface() {
	var _ release.ManagerInterface = suite.mockReleaseManager
}

func TestUpdaterTestSuite(t *testing.T) {
	suite.Run(t, new(UpdaterTestSuite))
}
