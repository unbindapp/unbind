package github_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/integrations/github"
)

// GET Github admin organizations for installation
type GithubAdminRepositoryListResponse struct {
	Body struct {
		Data []*github.GithubRepository `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) HandleListGithubAdminRepositories(ctx context.Context, input *server.BaseAuthInput) (*GithubAdminRepositoryListResponse, error) {
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	// Get owned installations
	// ! TODO - group RBAC
	installations, err := self.srv.Repository.Github().GetInstallationsByCreator(ctx, user.ID)
	if err != nil {
		log.Error("Error getting github installation", "err", err)
		return nil, huma.Error500InternalServerError("Failed to get github installation")
	}
	if len(installations) == 0 {
		return &GithubAdminRepositoryListResponse{
			Body: struct {
				Data []*github.GithubRepository `json:"data" nullable:"false"`
			}{
				Data: []*github.GithubRepository{},
			},
		}, nil
	}

	adminRepos, err := self.srv.GithubClient.ReadUserAdminRepositories(ctx, installations)
	if err != nil {
		log.Error("Error getting user admin organizations", "err", err)
		return nil, huma.Error500InternalServerError("Failed to get user admin organizations")
	}

	resp := &GithubAdminRepositoryListResponse{}
	resp.Body.Data = adminRepos
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
	// Get the installation by ID
	installationID := input.InstallationID
	installation, err := self.srv.Repository.Github().GetInstallationByID(ctx, installationID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, huma.Error404NotFound("GitHub installation not found")
		}
		log.Error("Error getting github installation", "err", err, "installationID", installationID)
		return nil, huma.Error500InternalServerError("Failed to get github installation")
	}

	// Get repository details
	repoDetail, err := self.srv.GithubClient.GetRepositoryDetail(ctx, installation, input.Owner, input.RepoName)
	if err != nil {
		log.Error("Error getting repository detail", "err", err, "owner", input.Owner, "repo", input.RepoName)
		return nil, huma.Error500InternalServerError("Failed to get repository details")
	}

	resp := &GithubRepositoryDetailResponse{}
	resp.Body.Data = repoDetail
	return resp, nil
}
