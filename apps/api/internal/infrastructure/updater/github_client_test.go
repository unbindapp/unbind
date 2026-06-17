package updater

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/go-github/v69/github"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/pkg/release"
)

// GitHubClientTestSuite defines the test suite for GitHub client wrapper
type GitHubClientTestSuite struct {
	suite.Suite
	ctx     context.Context
	wrapper release.GitHubClientInterface
}

func (suite *GitHubClientTestSuite) SetupTest() {
	suite.ctx = context.Background()

	// Create a real GitHub client for testing
	httpClient := &http.Client{}
	client := github.NewClient(httpClient)

	// Create the wrapper using the real implementation
	suite.wrapper = NewGitHubClientWrapper(client)
}

// Test NewGitHubClientWrapper function
func (suite *GitHubClientTestSuite) TestNewGitHubClientWrapper() {
	httpClient := &http.Client{}
	client := github.NewClient(httpClient)
	wrapper := NewGitHubClientWrapper(client)

	suite.NotNil(wrapper)
	suite.IsType(&githubClientWrapper{}, wrapper)
}

// Test Repositories method
func (suite *GitHubClientTestSuite) TestRepositories() {
	repositories := suite.wrapper.Repositories()

	suite.NotNil(repositories)
	suite.IsType(&repositoriesServiceWrapper{}, repositories)
}

// Test that the wrapper properly implements the interface
func (suite *GitHubClientTestSuite) TestInterfaceImplementation() {
	httpClient := &http.Client{}
	client := github.NewClient(httpClient)
	wrapper := NewGitHubClientWrapper(client)

	// Verify it implements the interface
	var _ release.GitHubClientInterface = wrapper

	// Verify repositories service implements the interface
	var _ release.RepositoriesServiceInterface = wrapper.Repositories()
}

// Test wrapper with nil client (should not panic)
func (suite *GitHubClientTestSuite) TestWrapperWithNilClient() {
	suite.NotPanics(func() {
		wrapper := NewGitHubClientWrapper(nil)
		suite.NotNil(wrapper)
	})
}

// Test method signatures without actually calling GitHub API
func (suite *GitHubClientTestSuite) TestMethodSignatures() {
	repoService := suite.wrapper.Repositories()
	suite.NotNil(repoService)

	// Just verify the methods exist with correct signatures
	// We don't actually call them to avoid network requests
	suite.IsType(&repositoriesServiceWrapper{}, repoService)
}

func TestGitHubClientTestSuite(t *testing.T) {
	suite.Run(t, new(GitHubClientTestSuite))
}
