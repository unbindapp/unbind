package github

import (
	"context"
	"fmt"
	"net/http"

	"github.com/google/go-github/v69/github"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// GitHubAppManifest represents the structure for GitHub App manifest
type GitHubAppManifest struct {
	Name               string             `json:"name"`
	Description        string             `json:"description"`
	URL                string             `json:"url"`
	HookAttributes     HookAttributes     `json:"hook_attributes"`
	RedirectURL        string             `json:"redirect_url"`
	SetupUrl           string             `json:"setup_url"`
	Public             bool               `json:"public"`
	DefaultPermissions DefaultPermissions `json:"default_permissions"`
	DefaultEvents      []string           `json:"default_events"`
}

// HookAttributes contains webhook configuration
type HookAttributes struct {
	URL string `json:"url"`
}

// DefaultPermissions contains permission settings
type DefaultPermissions struct {
	Contents     string `json:"contents"`
	Issues       string `json:"issues"`
	Metadata     string `json:"metadata"`
	PullRequests string `json:"pull_requests"`
	Members      string `json:"members,omitempty"`
}

// CreateAppManifest generates the GitHub App manifest
func (self *GithubClient) CreateAppManifest(redirectUrl string, setupUrl string, forOrganization bool) (manifest *GitHubAppManifest, appName string, err error) {
	// Generate a random suffix
	suffixRand, err := utils.GenerateRandomSimpleID(5)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate random suffix: %w", err)
	}

	appName = fmt.Sprintf("unbind-%s-%s", self.cfg.UnbindSuffix, suffixRand)

	manifest = &GitHubAppManifest{
		Name:        appName,
		Description: "Application to connect unbind with Github",
		URL:         self.cfg.ExternalAPIURL,
		HookAttributes: HookAttributes{
			URL: self.cfg.GithubWebhookURL,
		},
		RedirectURL: redirectUrl,
		SetupUrl:    setupUrl,
		Public:      false,
		DefaultPermissions: DefaultPermissions{
			Contents:     "read",
			Issues:       "write",
			Metadata:     "read",
			PullRequests: "read",
		},
		DefaultEvents: []string{"push", "pull_request"},
	}

	if forOrganization {
		manifest.DefaultPermissions.Members = "read"
	}

	return manifest, appName, nil
}

// ManifestCodeConversion gets app configruation from github using the code
func (self *GithubClient) ManifestCodeConversion(ctx context.Context, code string) (*github.AppConfig, error) {
	appConfig, response, err := self.client.Apps.CompleteAppManifest(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange manifest code: %w", err)
	}

	// Check for successful status code (201 Created)
	if response.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("unexpected status code: %d", response.StatusCode)
	}

	return appConfig, nil
}
