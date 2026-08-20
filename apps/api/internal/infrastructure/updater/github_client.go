package updater

import (
	"context"

	"github.com/google/go-github/v69/github"
	"github.com/unbindapp/unbind-api/pkg/release"
)

type githubClientWrapper struct {
	client *github.Client
}

func NewGitHubClientWrapper(client *github.Client) release.GitHubClientInterface {
	return &githubClientWrapper{client: client}
}

func (g *githubClientWrapper) Repositories() release.RepositoriesServiceInterface {
	return &repositoriesServiceWrapper{service: g.client.Repositories}
}

type repositoriesServiceWrapper struct {
	service *github.RepositoriesService
}

func (r *repositoriesServiceWrapper) ListReleases(ctx context.Context, owner, repo string, opts *github.ListOptions) ([]*github.RepositoryRelease, *github.Response, error) {
	return r.service.ListReleases(ctx, owner, repo, opts)
}

func (r *repositoriesServiceWrapper) GetContents(ctx context.Context, owner, repo, path string, opts *github.RepositoryContentGetOptions) (*github.RepositoryContent, []*github.RepositoryContent, *github.Response, error) {
	return r.service.GetContents(ctx, owner, repo, path, opts)
}
