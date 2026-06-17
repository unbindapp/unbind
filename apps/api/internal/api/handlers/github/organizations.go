package github_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/go-github/v69/github"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubinstallation"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

// GET Github admin organizations for installation
type GithubAdminOrganizationListInput struct {
	server.BaseAuthInput
	InstallationID int64 `path:"installation_id" required:"true"`
}

type GithubAdminOrganizationListResponse struct {
	Body struct {
		Data []*github.Organization `json:"data"`
	}
}

func (self *HandlerGroup) HandleListGithubAdminOrganizations(ctx context.Context, input *GithubAdminOrganizationListInput) (*GithubAdminOrganizationListResponse, error) {
	// Get installation
	installation, err := self.srv.Repository.Github().GetInstallationByID(ctx, input.InstallationID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, huma.Error404NotFound("Installation not found")
		}
		log.Error("Error getting github installation", "err", err)
		return nil, huma.Error500InternalServerError("Failed to get github installation")
	}
	if installation.AccountType != githubinstallation.AccountTypeUser {
		return nil, huma.Error400BadRequest("Invalid installation type")
	}

	adminOrgs, err := self.srv.GithubClient.ReadUserAdminOrganizations(ctx, installation)
	if err != nil {
		log.Error("Error getting user admin organizations", "err", err)
		return nil, huma.Error500InternalServerError("Failed to get user admin organizations")
	}

	resp := &GithubAdminOrganizationListResponse{}
	resp.Body.Data = adminOrgs
	return resp, nil
}
