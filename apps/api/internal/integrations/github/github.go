package github

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/google/go-github/v69/github"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// GithubClient handles GitHub integration operations
//
//go:generate go run -mod=mod github.com/vburenin/ifacemaker -f "*.go" -i GithubClientInterface -p github -s GithubClient -o github_client_iface.go
type GithubClient struct {
	cfg    *config.Config
	client *github.Client
}

func NewGithubClient(githubURL string, cfg *config.Config) *GithubClient {
	httpClient := &http.Client{}
	var githubClient *github.Client

	// Check if we're using GitHub Enterprise
	if githubURL != "https://github.com" && githubURL != "" {
		// For GitHub Enterprise, we need to set the base URL for the API
		baseURL := githubURL
		// Make sure the URL has a trailing slash for the github client
		if !strings.HasSuffix(baseURL, "/") {
			baseURL = baseURL + "/"
		}

		apiURL, _ := url.Parse(baseURL + "api/v3/")
		uploadURL, _ := url.Parse(baseURL + "api/uploads/")

		// Create a GitHub client with enterprise URLs
		githubClient, _ = github.NewClient(httpClient).WithEnterpriseURLs(apiURL.String(), uploadURL.String())
	} else {
		githubClient = github.NewClient(httpClient)
	}

	return &GithubClient{
		cfg:    cfg,
		client: githubClient,
	}
}

// Get the token we can use to authenticate with GitHub
func (self *GithubClient) GetInstallationToken(ctx context.Context, appID int64, installationID int64, appPrivateKey string) (string, error) {
	privateKey, err := utils.DecodePrivateKey(appPrivateKey)
	if err != nil {
		return "", err
	}

	bearerToken, err := utils.GenerateGithubJWT(appID, privateKey)
	if err != nil {
		return "", err
	}

	// Add token to client
	client := self.client.WithAuthToken(bearerToken)

	token, _, err := client.Apps.CreateInstallationToken(ctx, installationID, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create installation token: %v", err)
	}

	return token.GetToken(), nil
}

func (self *GithubClient) GetAuthenticatedClient(ctx context.Context, appID int64, installationID int64, appPrivateKey string) (*github.Client, error) {
	token, err := self.GetInstallationToken(ctx, appID, installationID, appPrivateKey)
	if err != nil {
		return nil, err
	}

	return self.client.WithAuthToken(token), nil
}
