package github_handler

import (
	"context"
	"strconv"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/githubinstallation"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

// GET Github app installations
type GithubAppInstallationListResponse struct {
	Body struct {
		Data []*GithubInstallationAPIResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) HandleListGithubAppInstallations(ctx context.Context, input *server.BaseAuthInput) (*GithubAppInstallationListResponse, error) {
	_, visibility, err := self.visibility(ctx)
	if err != nil {
		return nil, err
	}

	installations, err := self.srv.Repository.Github().GetVisibleInstallations(ctx, visibility, false)
	if err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to list the GitHub installations"))
	}
	ids := make([]int64, len(installations))
	for i, installation := range installations {
		ids[i] = installation.ID
	}
	counts, err := self.srv.Repository.Github().CountServicesByInstallation(ctx, ids, nil)
	if err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to count the services built from GitHub"))
	}

	resp := &GithubAppInstallationListResponse{}
	resp.Body.Data = transformGithubInstallationEntities(installations, counts)
	return resp, nil
}

// DELETE installation
type GithubInstallationDeleteInput struct {
	server.BaseAuthInput
	Body struct {
		InstallationID int64 `json:"installation_id" required:"true"`
	}
}

type GithubInstallationDeleteResponse struct {
	Body struct {
		Data server.DeletedResponse `json:"data"`
	}
}

func (self *HandlerGroup) HandleDeleteGithubInstallation(ctx context.Context, input *GithubInstallationDeleteInput) (*GithubInstallationDeleteResponse, error) {
	user, visibility, err := self.visibility(ctx)
	if err != nil {
		return nil, err
	}

	installation, err := self.srv.Repository.Github().GetVisibleInstallationByID(ctx, visibility, input.Body.InstallationID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, huma.Error404NotFound("GitHub installation not found")
		}
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to read the GitHub installation"))
	}
	if err := self.canManage(ctx, user, installation.Edges.GithubApp); err != nil {
		return nil, err
	}

	if err := self.srv.GithubClient.DeleteInstallation(ctx, installation.Edges.GithubApp, installation.ID); err != nil {
		log.Warnf("Failed to uninstall GitHub app %s from %s: %v", installation.Edges.GithubApp.Name, installation.AccountLogin, err)
	}
	if err := self.srv.Repository.Github().DeleteInstallation(ctx, installation.ID); err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to delete the GitHub installation"))
	}

	resp := &GithubInstallationDeleteResponse{}
	resp.Body.Data = server.DeletedResponse{ID: strconv.FormatInt(installation.ID, 10), Deleted: true}
	return resp, nil
}

func transformGithubInstallationEntity(entity *ent.GithubInstallation, serviceCount int) *GithubInstallationAPIResponse {
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
		ServiceCount:        serviceCount,
	}
}

func transformGithubInstallationEntities(entities []*ent.GithubInstallation, serviceCounts map[int64]int) []*GithubInstallationAPIResponse {
	result := make([]*GithubInstallationAPIResponse, len(entities))
	for i, entity := range entities {
		result[i] = transformGithubInstallationEntity(entity, serviceCounts[entity.ID])
	}
	return result
}

type GithubInstallationAPIResponse struct {
	ID int64 `json:"id"`
	// The time at which the entity was created.
	CreatedAt time.Time `json:"created_at"`
	// The time at which the entity was last updated.
	UpdatedAt time.Time `json:"updated_at"`
	// The GitHub App ID this installation belongs to
	GithubAppID int64 `json:"github_app_id"`
	// The GitHub account ID (org or user)
	AccountID int64 `json:"account_id"`
	// The GitHub account login (org or user name)
	AccountLogin string `json:"account_login"`
	// Type of GitHub account
	AccountType githubinstallation.AccountType `json:"account_type"`
	// The HTML URL to the GitHub account
	AccountURL string `json:"account_url"`
	// Whether the installation has access to all repos or only selected ones
	RepositorySelection githubinstallation.RepositorySelection `json:"repository_selection"`
	// Whether the installation is suspended
	Suspended bool `json:"suspended"`
	// Whether the installation is active
	Active bool `json:"active"`
	// Permissions granted to this installation
	Permissions schema.GithubInstallationPermissions `json:"permissions"`
	// Events this installation subscribes to
	Events []string `json:"events"`
	// How many services build from this installation, within the requested team when one was given
	ServiceCount int `json:"service_count"`
}
