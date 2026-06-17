package github

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/go-github/v69/github"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
)

type ManifestTestSuite struct {
	suite.Suite
	cfg    *config.Config
	client *GithubClient
	ctx    context.Context
}

func (suite *ManifestTestSuite) SetupTest() {
	suite.ctx = context.Background()
	suite.cfg = &config.Config{
		ExternalAPIURL:   "https://api.test.com",
		GithubWebhookURL: "https://webhook.test.com",
		UnbindSuffix:     "test",
	}
	suite.client = NewGithubClient("https://github.com", suite.cfg)
}

func (suite *ManifestTestSuite) TestCreateAppManifest_ForUser() {
	redirectUrl := "https://test.com/redirect"
	setupUrl := "https://test.com/setup"

	manifest, appName, err := suite.client.CreateAppManifest(redirectUrl, setupUrl, false)

	suite.NoError(err)
	suite.NotNil(manifest)
	suite.NotEmpty(appName)

	// Check app name format
	suite.Contains(appName, "unbind-test-")

	// Check manifest fields
	suite.Equal(appName, manifest.Name)
	suite.Equal("Application to connect unbind with Github", manifest.Description)
	suite.Equal(suite.cfg.ExternalAPIURL, manifest.URL)
	suite.Equal(suite.cfg.GithubWebhookURL, manifest.HookAttributes.URL)
	suite.Equal(redirectUrl, manifest.RedirectURL)
	suite.Equal(setupUrl, manifest.SetupUrl)
	suite.False(manifest.Public)

	// Check permissions
	suite.Equal("read", manifest.DefaultPermissions.Contents)
	suite.Equal("write", manifest.DefaultPermissions.Issues)
	suite.Equal("read", manifest.DefaultPermissions.Metadata)
	suite.Equal("read", manifest.DefaultPermissions.PullRequests)
	suite.Empty(manifest.DefaultPermissions.Members) // Should be empty for user

	// Check events
	suite.Contains(manifest.DefaultEvents, "push")
	suite.Contains(manifest.DefaultEvents, "pull_request")
}

func (suite *ManifestTestSuite) TestCreateAppManifest_ForOrganization() {
	redirectUrl := "https://test.com/redirect"
	setupUrl := "https://test.com/setup"

	manifest, appName, err := suite.client.CreateAppManifest(redirectUrl, setupUrl, true)

	suite.NoError(err)
	suite.NotNil(manifest)
	suite.NotEmpty(appName)

	// Check app name format
	suite.Contains(appName, "unbind-test-")

	// Check manifest fields
	suite.Equal(appName, manifest.Name)
	suite.Equal("Application to connect unbind with Github", manifest.Description)
	suite.Equal(suite.cfg.ExternalAPIURL, manifest.URL)
	suite.Equal(suite.cfg.GithubWebhookURL, manifest.HookAttributes.URL)
	suite.Equal(redirectUrl, manifest.RedirectURL)
	suite.Equal(setupUrl, manifest.SetupUrl)
	suite.False(manifest.Public)

	// Check permissions (should include members for organization)
	suite.Equal("read", manifest.DefaultPermissions.Contents)
	suite.Equal("write", manifest.DefaultPermissions.Issues)
	suite.Equal("read", manifest.DefaultPermissions.Metadata)
	suite.Equal("read", manifest.DefaultPermissions.PullRequests)
	suite.Equal("read", manifest.DefaultPermissions.Members) // Should be present for organization

	// Check events
	suite.Contains(manifest.DefaultEvents, "push")
	suite.Contains(manifest.DefaultEvents, "pull_request")
}

func (suite *ManifestTestSuite) TestManifestCodeConversion_Success() {
	// Create a mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify the request
		suite.Equal("POST", r.Method)
		suite.Contains(r.URL.Path, "/app-manifests/test-code/conversions")

		// Return mock app config response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{
			"id": 12345,
			"name": "test-app",
			"client_id": "test-client-id",
			"client_secret": "test-client-secret",
			"webhook_secret": "test-webhook-secret",
			"pem": "-----BEGIN RSA PRIVATE KEY-----\ntest-private-key\n-----END RSA PRIVATE KEY-----"
		}`))
	}))
	defer server.Close()

	// Create client with mock server
	httpClient := &http.Client{}
	githubClient := github.NewClient(httpClient)
	githubClient, _ = githubClient.WithEnterpriseURLs(server.URL+"/api/v3/", server.URL+"/api/uploads/")
	client := &GithubClient{
		cfg:    suite.cfg,
		client: githubClient,
	}

	appConfig, err := client.ManifestCodeConversion(suite.ctx, "test-code")

	suite.NoError(err)
	suite.NotNil(appConfig)
	suite.Equal(int64(12345), appConfig.GetID())
	suite.Equal("test-app", appConfig.GetName())
	suite.Equal("test-client-id", appConfig.GetClientID())
	suite.Equal("test-client-secret", appConfig.GetClientSecret())
	suite.Equal("test-webhook-secret", appConfig.GetWebhookSecret())
	suite.Equal("-----BEGIN RSA PRIVATE KEY-----\ntest-private-key\n-----END RSA PRIVATE KEY-----", appConfig.GetPEM())
}

func (suite *ManifestTestSuite) TestManifestCodeConversion_HTTPError() {
	// Create a mock server that returns an error
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"message": "Invalid code"}`))
	}))
	defer server.Close()

	// Create client with mock server
	httpClient := &http.Client{}
	githubClient := github.NewClient(httpClient)
	githubClient, _ = githubClient.WithEnterpriseURLs(server.URL+"/api/v3/", server.URL+"/api/uploads/")
	client := &GithubClient{
		cfg:    suite.cfg,
		client: githubClient,
	}

	appConfig, err := client.ManifestCodeConversion(suite.ctx, "invalid-code")

	suite.Error(err)
	suite.Nil(appConfig)
	suite.Contains(err.Error(), "failed to exchange manifest code")
}

func (suite *ManifestTestSuite) TestManifestCodeConversion_UnexpectedStatusCode() {
	// Create a mock server that returns unexpected status code
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK) // Should be 201, not 200
		w.Write([]byte(`{
			"id": 12345,
			"name": "test-app",
			"client_id": "test-client-id"
		}`))
	}))
	defer server.Close()

	// Create client with mock server
	httpClient := &http.Client{}
	githubClient := github.NewClient(httpClient)
	githubClient, _ = githubClient.WithEnterpriseURLs(server.URL+"/api/v3/", server.URL+"/api/uploads/")
	client := &GithubClient{
		cfg:    suite.cfg,
		client: githubClient,
	}

	appConfig, err := client.ManifestCodeConversion(suite.ctx, "test-code")

	suite.Error(err)
	suite.Nil(appConfig)
	suite.Contains(err.Error(), "unexpected status code: 200")
}

func TestManifestSuite(t *testing.T) {
	suite.Run(t, new(ManifestTestSuite))
}
