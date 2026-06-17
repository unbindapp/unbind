package updater

import (
	"context"

	"github.com/google/go-github/v69/github"
	"github.com/unbindapp/unbind-api/pkg/release"
)

// githubClientWrapper wraps the GitHub client to implement GitHubClientInterface
type githubClientWrapper struct {
	client *github.Client
}

// NewGitHubClientWrapper creates a new wrapper around the GitHub client
func NewGitHubClientWrapper(client *github.Client) release.GitHubClientInterface {
	return &githubClientWrapper{
		client: client,
	}
}

// Repositories returns the repositories service
func (g *githubClientWrapper) Repositories() release.RepositoriesServiceInterface {
	return &repositoriesServiceWrapper{
		service: g.client.Repositories,
	}
}

// repositoriesServiceWrapper wraps the GitHub repositories service
type repositoriesServiceWrapper struct {
	service *github.RepositoriesService
}

// ListTags lists the tags for a repository
func (r *repositoriesServiceWrapper) ListTags(ctx context.Context, owner, repo string, opts *github.ListOptions) ([]*github.RepositoryTag, *github.Response, error) {
	return r.service.ListTags(ctx, owner, repo, opts)
}

// ListReleases lists the releases for a repository
func (r *repositoriesServiceWrapper) ListReleases(ctx context.Context, owner, repo string, opts *github.ListOptions) ([]*github.RepositoryRelease, *github.Response, error) {
	return r.service.ListReleases(ctx, owner, repo, opts)
}
