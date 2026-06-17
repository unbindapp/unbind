package github_handler

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubinstallation"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

// GET Github app installations
type GithubAppInstallationListResponse struct {
	Body struct {
		Data []*GithubInstallationAPIResponse `json:"data"`
	}
}

func (self *HandlerGroup) HandleListGithubAppInstallations(ctx context.Context, input *server.BaseAuthInput) (*GithubAppInstallationListResponse, error) {
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	// ! TODO - RBAC
	installations, err := self.srv.Repository.Github().GetInstallationsByCreator(ctx, user.ID)
	if err != nil {
		log.Error("Error getting github installations", "err", err)
		return nil, huma.Error500InternalServerError("Failed to get github installations")
	}

	resp := &GithubAppInstallationListResponse{}
	resp.Body.Data = transformGithubInstallationEntities(installations)
	return resp, nil
}

func transformGithubInstallationEntity(entity *ent.GithubInstallation) *GithubInstallationAPIResponse {
	return &GithubInstallationAPIResponse{
		ID:                  entity.ID,
		CreatedAt:           entity.CreatedAt,
		UpdatedAt:           entity.UpdatedAt,
		GithubAppID:         entity.Edges.GithubApp.ID,
		AccountID:           entity.AccountID,
		AccountLogin:        entity.AccountLogin,
		AccountType:         entity.AccountType,
		AccountURL:          entity.AccountURL,
		RepositorySelection: entity.RepositorySelection,
		Suspended:           entity.Suspended,
		Active:              entity.Active,
		Permissions:         entity.Permissions,
		Events:              entity.Events,
	}
}

func transformGithubInstallationEntities(entities []*ent.GithubInstallation) []*GithubInstallationAPIResponse {
	result := make([]*GithubInstallationAPIResponse, len(entities))
	for i, entity := range entities {
		result[i] = transformGithubInstallationEntity(entity)
	}
	return result
}

type GithubInstallationAPIResponse struct {
	ID int64 `json:"id,omitempty"`
	// The time at which the entity was created.
	CreatedAt time.Time `json:"created_at,omitempty"`
	// The time at which the entity was last updated.
	UpdatedAt time.Time `json:"updated_at,omitempty"`
	// The GitHub App ID this installation belongs to
	GithubAppID int64 `json:"github_app_id,omitempty"`
	// The GitHub account ID (org or user)
	AccountID int64 `json:"account_id,omitempty"`
	// The GitHub account login (org or user name)
	AccountLogin string `json:"account_login,omitempty"`
	// Type of GitHub account
	AccountType githubinstallation.AccountType `json:"account_type,omitempty"`
	// The HTML URL to the GitHub account
	AccountURL string `json:"account_url,omitempty"`
	// Whether the installation has access to all repos or only selected ones
	RepositorySelection githubinstallation.RepositorySelection `json:"repository_selection,omitempty"`
	// Whether the installation is suspended
	Suspended bool `json:"suspended,omitempty"`
	// Whether the installation is active
	Active bool `json:"active,omitempty"`
	// Permissions granted to this installation
	Permissions schema.GithubInstallationPermissions `json:"permissions,omitempty"`
	// Events this installation subscribes to
	Events []string `json:"events,omitempty"`
}
