package registry

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	mocks_infrastructure_k8s "github.com/unbindapp/unbind-api/mocks/infrastructure/k8s"
	mocks_repositories "github.com/unbindapp/unbind-api/mocks/repositories"
	mocks_repository_system "github.com/unbindapp/unbind-api/mocks/repository/system"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/fake"
)

type RegistryTesterTestSuite struct {
	suite.Suite
	ctx             context.Context
	cancel          context.CancelFunc
	config          *config.Config
	mockRepo        *mocks_repositories.RepositoriesMock
	mockSystemRepo  *mocks_repository_system.SystemRepositoryMock
	mockKubeClient  *mocks_infrastructure_k8s.KubeClientMock
	fakeK8sClient   kubernetes.Interface
	registryTester  *RegistryTester
	dockerHubServer *httptest.Server
	ghcrServer      *httptest.Server
	quayServer      *httptest.Server
	privateServer   *httptest.Server
}

func (suite *RegistryTesterTestSuite) SetupSuite() {
	suite.ctx, suite.cancel = context.WithTimeout(context.Background(), 30*time.Second)

	// Setup configuration
	suite.config = &config.Config{
		SystemNamespace: "default",
	}

	// Setup mocks
	suite.mockRepo = &mocks_repositories.RepositoriesMock{}
	suite.mockSystemRepo = &mocks_repository_system.SystemRepositoryMock{}
	suite.mockKubeClient = &mocks_infrastructure_k8s.KubeClientMock{}
	suite.fakeK8sClient = fake.NewSimpleClientset()

	// Setup repository mock to return system repo
	suite.mockRepo.On("System").Return(suite.mockSystemRepo)

	// Setup Docker Hub mock server
	suite.dockerHubServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/token":
			// Docker Hub token endpoint
			response := map[string]string{"token": "mock-token"}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		case r.URL.Path == "/v2/library/busybox/manifests/latest":
			// Valid manifest check
			w.WriteHeader(http.StatusOK)
		case r.URL.Path == "/v2/library/nonexistent/manifests/latest":
			// Non-existent image
			w.WriteHeader(http.StatusNotFound)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))

	// Setup GHCR mock server
	suite.ghcrServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v2/github/super-linter/manifests/latest" {
			// Check credentials
			username, password, ok := r.BasicAuth()
			if ok && username == "valid-user" && password == "valid-token" {
				w.WriteHeader(http.StatusOK)
			} else {
				w.WriteHeader(http.StatusUnauthorized)
			}
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))

	// Setup Quay mock server
	suite.quayServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v2/quay/busybox/manifests/latest" {
			// Check credentials
			username, password, ok := r.BasicAuth()
			if ok && username == "valid-user" && password == "valid-token" {
				w.WriteHeader(http.StatusOK)
			} else {
				w.WriteHeader(http.StatusUnauthorized)
			}
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))

	// Setup private registry mock server
	suite.privateServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v2/myapp/manifests/v1.0":
			// Check credentials
			username, password, ok := r.BasicAuth()
			if ok && username == "admin" && password == "secret" {
				w.WriteHeader(http.StatusOK)
			} else {
				w.WriteHeader(http.StatusUnauthorized)
			}
		case "/v2/myapp/manifests/latest":
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))

	// Create registry tester with mocks
	suite.registryTester = NewRegistryTester(suite.config, suite.mockRepo, suite.mockKubeClient)
}

func (suite *RegistryTesterTestSuite) TearDownSuite() {
	if suite.cancel != nil {
		suite.cancel()
	}
	if suite.dockerHubServer != nil {
		suite.dockerHubServer.Close()
	}
	if suite.ghcrServer != nil {
		suite.ghcrServer.Close()
	}
	if suite.quayServer != nil {
		suite.quayServer.Close()
	}
	if suite.privateServer != nil {
		suite.privateServer.Close()
	}
}

func (suite *RegistryTesterTestSuite) SetupTest() {
	// Reset mocks before each test
	suite.mockRepo.ExpectedCalls = nil
	suite.mockSystemRepo.ExpectedCalls = nil
	suite.mockKubeClient.ExpectedCalls = nil

	// Re-setup the basic mock relationship
	suite.mockRepo.On("System").Return(suite.mockSystemRepo)

	// Set up a default mock HTTP client for all tests to prevent hanging
	suite.registryTester.httpClient = &http.Client{
		Transport: &MockRoundTripper{
			Response: &http.Response{
				StatusCode: http.StatusNotFound,
				Body:       http.NoBody,
			},
		},
		Timeout: 1 * time.Second, // Short timeout to prevent hanging
	}
}

// Test ParseImageString function
func (suite *RegistryTesterTestSuite) TestParseImageString_DockerHub() {
	testCases := []struct {
		name             string
		image            string
		expectedRegistry string
		expectedImage    string
		expectedTag      string
	}{
		{
			name:             "Simple image name",
			image:            "busybox",
			expectedRegistry: "docker.io",
			expectedImage:    "library/busybox",
			expectedTag:      "latest",
		},
		{
			name:             "Image with tag",
			image:            "busybox:1.35",
			expectedRegistry: "docker.io",
			expectedImage:    "library/busybox",
			expectedTag:      "1.35",
		},
		{
			name:             "User image",
			image:            "nginx/nginx-prometheus-exporter",
			expectedRegistry: "docker.io",
			expectedImage:    "nginx/nginx-prometheus-exporter",
			expectedTag:      "latest",
		},
		{
			name:             "User image with tag",
			image:            "nginx/nginx-prometheus-exporter:0.10.0",
			expectedRegistry: "docker.io",
			expectedImage:    "nginx/nginx-prometheus-exporter",
			expectedTag:      "0.10.0",
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			registry, image, tag := ParseImageString(tc.image)
			suite.Equal(tc.expectedRegistry, registry)
			suite.Equal(tc.expectedImage, image)
			suite.Equal(tc.expectedTag, tag)
		})
	}
}

func (suite *RegistryTesterTestSuite) TestParseImageString_PrivateRegistry() {
	testCases := []struct {
		name             string
		image            string
		expectedRegistry string
		expectedImage    string
		expectedTag      string
	}{
		{
			name:             "Private registry with port",
			image:            "registry.example.com:5000/myapp:latest",
			expectedRegistry: "registry.example.com:5000",
			expectedImage:    "myapp",
			expectedTag:      "latest",
		},
		{
			name:             "Private registry without port",
			image:            "registry.example.com/myapp:v1.0",
			expectedRegistry: "registry.example.com",
			expectedImage:    "myapp",
			expectedTag:      "v1.0",
		},
		{
			name:             "GHCR registry",
			image:            "ghcr.io/owner/repo:main",
			expectedRegistry: "ghcr.io",
			expectedImage:    "owner/repo",
			expectedTag:      "main",
		},
		{
			name:             "Quay registry",
			image:            "quay.io/organization/image:tag",
			expectedRegistry: "quay.io",
			expectedImage:    "organization/image",
			expectedTag:      "tag",
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			registry, image, tag := ParseImageString(tc.image)
			suite.Equal(tc.expectedRegistry, registry)
			suite.Equal(tc.expectedImage, image)
			suite.Equal(tc.expectedTag, tag)
		})
	}
}

func (suite *RegistryTesterTestSuite) TestParseImageString_EdgeCases() {
	testCases := []struct {
		name             string
		image            string
		expectedRegistry string
		expectedImage    string
		expectedTag      string
	}{
		{
			name:             "Image with IP address",
			image:            "192.168.1.100:5000/app:latest",
			expectedRegistry: "192.168.1.100:5000",
			expectedImage:    "app",
			expectedTag:      "latest",
		},
		{
			name:             "Image with multiple colons in tag",
			image:            "app:2023-01-01T10:30:00Z",
			expectedRegistry: "docker.io",
			expectedImage:    "library/app:2023-01-01T10:30",
			expectedTag:      "00Z",
		},
		{
			name:             "No tag specified",
			image:            "myregistry.com/myapp",
			expectedRegistry: "myregistry.com",
			expectedImage:    "myapp",
			expectedTag:      "latest",
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			registry, image, tag := ParseImageString(tc.image)
			suite.Equal(tc.expectedRegistry, registry)
			suite.Equal(tc.expectedImage, image)
			suite.Equal(tc.expectedTag, tag)
		})
	}
}

// Test CanPullImage function - simplified to avoid external network calls
func (suite *RegistryTesterTestSuite) TestCanPullImage_PublicImage() {
	// Setup mocks
	suite.mockSystemRepo.On("GetAllRegistries", suite.ctx).Return([]*ent.Registry{}, nil)

	// Mock the HTTP client to handle Docker Hub token and manifest requests
	suite.registryTester.httpClient = &http.Client{
		Transport: &MockRoundTripper{
			Responses: map[string]*http.Response{
				"https://auth.docker.io/token": {
					StatusCode: http.StatusOK,
					Body:       &MockReadCloser{Data: `{"token":"valid-token"}`},
				},
				"https://index.docker.io/v2/library/busybox/manifests/latest": {
					StatusCode: http.StatusOK,
					Body:       http.NoBody,
				},
			},
		},
		Timeout: 5 * time.Second,
	}

	// Test public image that should be accessible
	canPull, err := suite.registryTester.CanPullImage(suite.ctx, "busybox:latest")

	suite.NoError(err)
	suite.True(canPull)
	suite.mockSystemRepo.AssertExpectations(suite.T())
}

func (suite *RegistryTesterTestSuite) TestCanPullImage_PrivateImageWithCredentials() {
	// Setup registry with credentials
	registry := &ent.Registry{
		ID:               uuid.New(),
		Host:             "registry.example.com",
		KubernetesSecret: "registry-secret",
	}

	// Setup secret with credentials
	secret := &v1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "registry-secret",
			Namespace: "default",
		},
		Data: map[string][]byte{
			".dockerconfigjson": []byte(`{"auths":{"registry.example.com":{"username":"admin","password":"secret"}}}`),
		},
	}

	// Setup mocks
	suite.mockSystemRepo.On("GetAllRegistries", suite.ctx).Return([]*ent.Registry{registry}, nil)
	suite.mockKubeClient.On("GetInternalClient").Return(suite.fakeK8sClient)
	suite.mockKubeClient.On("GetSecret", suite.ctx, "registry-secret", "default", suite.fakeK8sClient).Return(secret, nil)
	suite.mockKubeClient.On("ParseRegistryCredentials", secret).Return("admin", "secret", nil)

	// Mock the HTTP client to fail for public access but succeed for authenticated requests
	suite.registryTester.httpClient = &http.Client{
		Transport: &MockRoundTripper{},
		Timeout:   5 * time.Second,
	}

	// Test private image with credentials
	canPull, err := suite.registryTester.CanPullImage(suite.ctx, "registry.example.com/myapp:latest")

	suite.NoError(err)
	suite.True(canPull)
	suite.mockSystemRepo.AssertExpectations(suite.T())
	suite.mockKubeClient.AssertExpectations(suite.T())
}

func (suite *RegistryTesterTestSuite) TestCanPullImage_RepositoryError() {
	// Setup mock to return error
	suite.mockSystemRepo.On("GetAllRegistries", suite.ctx).Return(nil, assert.AnError)

	// Test should return error when repository fails
	canPull, err := suite.registryTester.CanPullImage(suite.ctx, "busybox:latest")

	suite.Error(err)
	suite.False(canPull)
	suite.mockSystemRepo.AssertExpectations(suite.T())
}

func (suite *RegistryTesterTestSuite) TestCanPullImage_SecretRetrievalError() {
	// Setup registry with credentials
	registry := &ent.Registry{
		ID:               uuid.New(),
		Host:             "registry.example.com",
		KubernetesSecret: "registry-secret",
	}

	// Setup mocks
	suite.mockSystemRepo.On("GetAllRegistries", suite.ctx).Return([]*ent.Registry{registry}, nil)
	suite.mockKubeClient.On("GetInternalClient").Return(suite.fakeK8sClient)
	suite.mockKubeClient.On("GetSecret", suite.ctx, "registry-secret", "default", suite.fakeK8sClient).Return(nil, assert.AnError)

	// Test private image where secret retrieval fails
	canPull, err := suite.registryTester.CanPullImage(suite.ctx, "registry.example.com/myapp:latest")

	suite.NoError(err) // Should not error, just return false
	suite.False(canPull)
	suite.mockSystemRepo.AssertExpectations(suite.T())
	suite.mockKubeClient.AssertExpectations(suite.T())
}

// Test TestRegistryCredentials function - use mock responses
func (suite *RegistryTesterTestSuite) TestTestRegistryCredentials_DockerHub() {
	// Mock successful token response for Docker Hub
	suite.registryTester.httpClient = &http.Client{
		Transport: &MockRoundTripper{
			Responses: map[string]*http.Response{
				"https://auth.docker.io/token": {
					StatusCode: http.StatusOK,
					Body:       &MockReadCloser{Data: `{"token":"valid-token"}`},
				},
				"https://index.docker.io/v2/library/busybox/manifests/latest": {
					StatusCode: http.StatusOK,
					Body:       http.NoBody,
				},
			},
		},
		Timeout: 5 * time.Second,
	}

	// Test valid credentials
	isValid, err := suite.registryTester.TestRegistryCredentials(suite.ctx, "docker.io", "valid-user", "valid-token")

	suite.NoError(err)
	suite.True(isValid)
}

func (suite *RegistryTesterTestSuite) TestTestRegistryCredentials_GHCR() {
	// Mock successful response for GHCR
	suite.registryTester.httpClient = &http.Client{
		Transport: &MockRoundTripper{
			Response: &http.Response{
				StatusCode: http.StatusOK,
				Body:       http.NoBody,
			},
		},
		Timeout: 5 * time.Second,
	}

	// Test valid credentials
	isValid, err := suite.registryTester.TestRegistryCredentials(suite.ctx, "ghcr.io", "valid-user", "valid-token")

	suite.NoError(err)
	suite.True(isValid)
}

func (suite *RegistryTesterTestSuite) TestTestRegistryCredentials_Quay() {
	// Mock successful response for Quay
	suite.registryTester.httpClient = &http.Client{
		Transport: &MockRoundTripper{
			Response: &http.Response{
				StatusCode: http.StatusOK,
				Body:       http.NoBody,
			},
		},
		Timeout: 5 * time.Second,
	}

	// Test valid credentials
	isValid, err := suite.registryTester.TestRegistryCredentials(suite.ctx, "quay.io", "valid-user", "valid-token")

	suite.NoError(err)
	suite.True(isValid)
}

func (suite *RegistryTesterTestSuite) TestTestRegistryCredentials_InvalidCredentials() {
	// Mock failed response for invalid credentials
	suite.registryTester.httpClient = &http.Client{
		Transport: &MockRoundTripper{
			Responses: map[string]*http.Response{
				"https://auth.docker.io/token": {
					StatusCode: http.StatusUnauthorized,
					Body:       http.NoBody,
				},
			},
		},
		Timeout: 5 * time.Second,
	}

	// Test invalid credentials for Docker Hub
	isValid, err := suite.registryTester.TestRegistryCredentials(suite.ctx, "docker.io", "invalid-user", "invalid-token")

	suite.NoError(err)
	suite.False(isValid)
}

func (suite *RegistryTesterTestSuite) TestTestRegistryCredentials_ArbitraryRegistry() {
	// Mock successful response for arbitrary registry
	suite.registryTester.httpClient = &http.Client{
		Transport: &MockRoundTripper{
			Response: &http.Response{
				StatusCode: http.StatusOK,
				Body:       http.NoBody,
			},
		},
		Timeout: 5 * time.Second,
	}

	// Test arbitrary registry
	isValid, err := suite.registryTester.TestRegistryCredentials(suite.ctx, "my-registry.example.com", "admin", "secret")

	suite.NoError(err)
	suite.True(isValid)
}

// Test context cancellation
func (suite *RegistryTesterTestSuite) TestCanPullImage_ContextCancellation() {
	// Create cancelled context
	cancelledCtx, cancel := context.WithCancel(context.Background())
	cancel()

	// Setup mock to expect cancelled context
	suite.mockSystemRepo.On("GetAllRegistries", cancelledCtx).Return(nil, context.Canceled)

	// Test with cancelled context
	canPull, err := suite.registryTester.CanPullImage(cancelledCtx, "busybox:latest")

	suite.Error(err)
	suite.False(canPull)
	suite.mockSystemRepo.AssertExpectations(suite.T())
}

// Test credentials parsing error
func (suite *RegistryTesterTestSuite) TestCanPullImage_InvalidCredentialsParsing() {
	// Setup registry with invalid secret
	registry := &ent.Registry{
		ID:               uuid.New(),
		Host:             "registry.example.com",
		KubernetesSecret: "invalid-secret",
	}

	secret := &v1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "invalid-secret",
			Namespace: "default",
		},
		Data: map[string][]byte{
			".dockerconfigjson": []byte(`invalid-json`),
		},
	}

	// Setup mocks
	suite.mockSystemRepo.On("GetAllRegistries", suite.ctx).Return([]*ent.Registry{registry}, nil)
	suite.mockKubeClient.On("GetInternalClient").Return(suite.fakeK8sClient)
	suite.mockKubeClient.On("GetSecret", suite.ctx, "invalid-secret", "default", suite.fakeK8sClient).Return(secret, nil)
	suite.mockKubeClient.On("ParseRegistryCredentials", secret).Return("", "", assert.AnError)

	// Test private image with invalid credentials
	canPull, err := suite.registryTester.CanPullImage(suite.ctx, "registry.example.com/myapp:latest")

	suite.NoError(err) // Should not error, just return false
	suite.False(canPull)
	suite.mockSystemRepo.AssertExpectations(suite.T())
	suite.mockKubeClient.AssertExpectations(suite.T())
}

// Mock HTTP transport for testing
type MockRoundTripper struct {
	Response  *http.Response
	Responses map[string]*http.Response
	Error     error
	callCount int
}

func (m *MockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if m.Error != nil {
		return nil, m.Error
	}

	if m.Responses != nil {
		// Check exact URL match first
		if resp, ok := m.Responses[req.URL.String()]; ok {
			return resp, nil
		}
		// Check for partial matches for Docker Hub token requests
		for url, resp := range m.Responses {
			if strings.Contains(req.URL.String(), "auth.docker.io/token") && strings.Contains(url, "auth.docker.io/token") {
				return resp, nil
			}
		}
	}

	if m.Response != nil {
		return m.Response, nil
	}

	// Handle call count logic for testing different responses on sequential calls
	m.callCount++
	statusCode := http.StatusNotFound
	if m.callCount == 1 {
		// First call (public access) should fail
		statusCode = http.StatusUnauthorized
	} else {
		// Subsequent calls (with credentials) should succeed
		statusCode = http.StatusOK
	}

	return &http.Response{
		StatusCode: statusCode,
		Body:       http.NoBody,
	}, nil
}

// Mock ReadCloser for response bodies
type MockReadCloser struct {
	Data string
	pos  int
}

func (m *MockReadCloser) Read(p []byte) (int, error) {
	if m.pos >= len(m.Data) {
		return 0, nil
	}
	n := copy(p, m.Data[m.pos:])
	m.pos += n
	return n, nil
}

func (m *MockReadCloser) Close() error {
	return nil
}

func TestRegistryTesterTestSuite(t *testing.T) {
	suite.Run(t, new(RegistryTesterTestSuite))
}
