package github_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/integrations/github"
	"github.com/unbindapp/unbind-api/internal/watchpaths"
)

type GithubRepositoryListResponse struct {
	Body struct {
		Data []*github.GithubRepository `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) HandleListGithubRepositories(ctx context.Context, input *server.BaseAuthInput) (*GithubRepositoryListResponse, error) {
	installations, err := self.srv.Repository.Github().GetInstallations(ctx)
	if err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to read the GitHub installation"))
	}
	if len(installations) == 0 {
		return &GithubRepositoryListResponse{
			Body: struct {
				Data []*github.GithubRepository `json:"data" nullable:"false"`
			}{
				Data: []*github.GithubRepository{},
			},
		}, nil
	}

	repos, err := self.srv.GithubClient.ReadInstallationRepositories(ctx, installations)
	if err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to list the repositories"))
	}

	resp := &GithubRepositoryListResponse{}
	resp.Body.Data = repos
	return resp, nil
}

// GET github repository details (branches, tags, etc.)
type GithubRepositoryDetailInput struct {
	server.BaseAuthInput
	InstallationID int64  `query:"installation_id" required:"true"`
	Owner          string `query:"owner" required:"true"`
	RepoName       string `query:"repo_name" required:"true"`
}

type GithubRepositoryDetailResponse struct {
	Body struct {
		Data *github.GithubRepositoryDetail `json:"data"`
	}
}

func (self *HandlerGroup) HandleGetGithubRepositoryDetail(ctx context.Context, input *GithubRepositoryDetailInput) (*GithubRepositoryDetailResponse, error) {
	installationID := input.InstallationID
	installation, err := self.srv.Repository.Github().GetInstallationByID(ctx, installationID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, huma.Error404NotFound("GitHub installation not found")
		}
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to read the GitHub installation"))
	}

	repoDetail, err := self.srv.GithubClient.GetRepositoryDetail(ctx, installation, input.Owner, input.RepoName)
	if err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to read the repository details"))
	}

	resp := &GithubRepositoryDetailResponse{}
	resp.Body.Data = repoDetail
	return resp, nil
}

// GET watch path suggestions derived from a repository's file tree
type GithubWatchPathSuggestionsInput struct {
	server.BaseAuthInput
	InstallationID int64  `query:"installation_id" required:"true"`
	Owner          string `query:"owner" required:"true"`
	RepoName       string `query:"repo_name" required:"true"`
	Ref            string `query:"ref" required:"true" doc:"Branch or tag to read the file tree from"`
}

type GithubWatchPathSuggestions struct {
	Suggestions []string `json:"suggestions" nullable:"false"`
	Truncated   bool     `json:"truncated" doc:"GitHub capped the file tree, so some paths are missing"`
}

type GithubWatchPathSuggestionsResponse struct {
	Body struct {
		Data *GithubWatchPathSuggestions `json:"data"`
	}
}

func (self *HandlerGroup) HandleGetGithubWatchPathSuggestions(ctx context.Context, input *GithubWatchPathSuggestionsInput) (*GithubWatchPathSuggestionsResponse, error) {
	installation, err := self.srv.Repository.Github().GetInstallationByID(ctx, input.InstallationID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, huma.Error404NotFound("GitHub installation not found")
		}
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to read the GitHub installation"))
	}

	files, truncated, err := self.srv.GithubClient.GetRepositoryFiles(ctx, installation, input.Owner, input.RepoName, input.Ref)
	if err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to list the repository files"))
	}

	resp := &GithubWatchPathSuggestionsResponse{}
	resp.Body.Data = &GithubWatchPathSuggestions{
		Suggestions: watchpaths.Suggestions(files),
		Truncated:   truncated,
	}
	return resp, nil
}
