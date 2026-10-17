package github_handler

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	github_repo "github.com/unbindapp/unbind-api/internal/repositories/github"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

type HandlerGroup struct {
	srv *server.Server
}

// visibility is what the caller may see: the apps they connected and the ones shared with a team they can view
func (self *HandlerGroup) visibility(ctx context.Context) (*ent.User, github_repo.AppVisibility, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, github_repo.AppVisibility{}, err
	}
	teams, err := self.srv.Repository.Permissions().GetAccessibleTeamPredicates(ctx, user.ID, schema.ActionViewer)
	if err != nil {
		return nil, github_repo.AppVisibility{}, oapi.MapError(err)
	}
	return user, github_repo.AppVisibility{UserID: user.ID, Teams: teams}, nil
}

// teamVisibility is what the caller can build from in a team they can see
func (self *HandlerGroup) teamVisibility(ctx context.Context, teamID uuid.UUID) (github_repo.AppVisibility, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return github_repo.AppVisibility{}, err
	}
	if err := self.srv.Repository.Permissions().CheckVisible(ctx, user.ID, schema.ResourceTypeTeam, teamID); err != nil {
		return github_repo.AppVisibility{}, oapi.MapError(errdefs.MaskAsNotFound(err, "Team not found"))
	}
	return github_repo.TeamAppVisibility(user.ID, teamID), nil
}

func (self *HandlerGroup) checkTeam(ctx context.Context, userID uuid.UUID, teamID uuid.UUID, action schema.PermittedAction) error {
	checks := []permissions_repo.PermissionCheck{
		{Action: action, ResourceType: schema.ResourceTypeTeam, ResourceID: teamID},
	}
	if err := self.srv.Repository.Permissions().Check(ctx, userID, checks); err != nil {
		return oapi.MapError(err)
	}
	return nil
}

func (self *HandlerGroup) isSystemAdmin(ctx context.Context, userID uuid.UUID) (bool, error) {
	checks := []permissions_repo.PermissionCheck{
		{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeSystem},
	}
	err := self.srv.Repository.Permissions().Check(ctx, userID, checks)
	if errors.Is(err, errdefs.ErrUnauthorized) {
		return false, nil
	}
	if err != nil {
		return false, oapi.MapError(err)
	}
	return true, nil
}

// canManage says whether the user may remove the app or its installations: the creator and system
// admins can, and once the creator is gone so can an editor of every team it is shared with, unless that is all teams
func (self *HandlerGroup) canManage(ctx context.Context, user *ent.User, app *ent.GithubApp) error {
	if app.CreatedBy != nil && *app.CreatedBy == user.ID {
		return nil
	}
	isAdmin, err := self.isSystemAdmin(ctx, user.ID)
	if err != nil {
		return err
	}
	if isAdmin {
		return nil
	}
	if app.CreatedBy != nil {
		return huma.Error403Forbidden("Only the user who connected the app or a system admin can remove it")
	}
	if app.SharedWithAllTeams {
		return huma.Error403Forbidden("The app is shared with all teams. Ask a system admin to remove it.")
	}
	teamIDs, err := self.srv.Repository.Github().GetAppTeamIDs(ctx, app.ID)
	if err != nil {
		return oapi.MapError(errdefs.NewInternalError(err, "Failed to read the GitHub app's teams"))
	}
	for _, teamID := range teamIDs {
		if err := self.checkTeam(ctx, user.ID, teamID, schema.ActionEditor); err != nil {
			return huma.Error403Forbidden("The app is shared with other teams too. Stop sharing it with your team, or ask a system admin to remove it.")
		}
	}
	return nil
}

// RegisterHandlers serves the reads an API key may use to pick an installation and repository for a service
func RegisterHandlers(server *server.Server, grp *huma.Group) {
	handlers := &HandlerGroup{
		srv: server,
	}

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-github-installations",
		Summary:     "List GitHub Installations",
		Description: "List the GitHub accounts and organizations the caller can build from in a team: their own connections, the ones shared with the team and the ones shared with all teams. Pass an installation's id as github_installation_id to create-service in that team. An installation that is suspended or not active cannot be used. With repository_selection selected, only the repositories picked on GitHub are reachable; list-github-repositories shows them.",
		Path:        "/installations",
		Method:      http.MethodGet,
	}, handlers.HandleListGithubAppInstallations, oapi.MCP)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-github-repositories",
		Summary:     "List GitHub Repositories",
		Description: "List the repositories the caller can build in a team, each with the installation_id to pass to create-service along with owner.login and name. A repository missing here cannot be built in the team until it is added to the installation on GitHub or its connection is shared with the team.",
		Path:        "/repositories",
		Method:      http.MethodGet,
	}, handlers.HandleListGithubRepositories, oapi.OpenWorld, oapi.MCP)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-github-repository",
		Summary:     "Get GitHub Repository",
		Description: "Get a repository's default branch, branches and tags through a GitHub installation usable in the team, to pick the branch for create-service.",
		Path:        "/repositories/info",
		Method:      http.MethodGet,
	}, handlers.HandleGetGithubRepositoryDetail, oapi.OpenWorld, oapi.MCP)
}

// RegisterSessionOnlyHandlers connects, shares and removes GitHub apps, which API keys may never do
func RegisterSessionOnlyHandlers(server *server.Server, grp *huma.Group) {
	handlers := &HandlerGroup{
		srv: server,
	}

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "app-create",
		Summary:     "Create App",
		Description: "Begin the GitHub app creation flow, returning the manifest to POST to GitHub. The app belongs to the caller; pass team_id to share it with a team.",
		Path:        "/app/create",
		Method:      http.MethodGet,
	}, handlers.HandleGithubAppCreate, oapi.OpenWorld)

	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "app-save",
		Summary:     "Save App",
		Description: "Finish the GitHub app creation flow with the code and state GitHub returned. Only the user who started the flow can save the app. Returns the URL to install it.",
		Path:        "/app/save",
		Method:      http.MethodPost,
	}, handlers.HandleGithubAppSave, oapi.OpenWorld)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-github-app",
		Summary:     "Get App",
		Description: "Get a GitHub app the caller connected or that is shared with one of their teams.",
		Path:        "/app/get",
		Method:      http.MethodGet,
	}, handlers.HandleGetGithubApp)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-apps",
		Summary:     "List Apps",
		Description: "List the GitHub apps the caller connected or that are shared with a team they can view.",
		Path:        "/apps",
		Method:      http.MethodGet,
	}, handlers.HandleListGithubApps)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-app-teams",
		Summary:     "Update App Teams",
		Description: "Share a GitHub app with teams or stop sharing it. The creator adds teams they can edit and a system admin adds any team or shares it with all teams, including future ones; a team editor can only remove their own team. An app whose creator is gone keeps at least one team.",
		Path:        "/app/teams",
		Method:      http.MethodPut,
	}, handlers.HandleUpdateGithubAppTeams)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-app",
		Summary:     "Delete App",
		Description: "Remove a GitHub app and uninstall it from every account. Services built from it keep running but stop deploying on push. The app itself has to be deleted on GitHub.",
		Path:        "/app/delete",
		Method:      http.MethodDelete,
	}, handlers.HandleDeleteGithubApp, oapi.OpenWorld)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-installation",
		Summary:     "Delete Installation",
		Description: "Uninstall a GitHub app from one account. Services built from it keep running but stop deploying on push. The row is removed even when GitHub cannot be reached.",
		Path:        "/installation/delete",
		Method:      http.MethodDelete,
	}, handlers.HandleDeleteGithubInstallation, oapi.OpenWorld)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "repo-watch-path-suggestions",
		Summary:     "Watch Path Suggestions",
		Description: "Suggest watch path patterns from a repository's file tree.",
		Path:        "/repositories/watch-paths",
		Method:      http.MethodGet,
	}, handlers.HandleGetGithubWatchPathSuggestions, oapi.OpenWorld)
}

// RegisterPublicHandlers serves the routes GitHub itself calls, so they carry no session
func RegisterPublicHandlers(server *server.Server, grp *huma.Group) {
	handlers := &HandlerGroup{
		srv: server,
	}

	oapi.Register(grp, oapi.Invoke, huma.Operation{
		OperationID: "github-webhook",
		Summary:     "GitHub Webhook",
		Description: "Receive GitHub webhook events. Authenticated by GitHub's signature header, not a session.",
		Path:        "/webhook",
		Method:      http.MethodPost,
	}, handlers.HandleGithubWebhook, oapi.Public)
}
