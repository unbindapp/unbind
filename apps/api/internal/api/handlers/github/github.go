package github_handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
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

func (self *HandlerGroup) checkTeam(ctx context.Context, userID uuid.UUID, teamID uuid.UUID, action schema.PermittedAction) error {
	checks := []permissions_repo.PermissionCheck{
		{Action: action, ResourceType: schema.ResourceTypeTeam, ResourceID: teamID},
	}
	if err := self.srv.Repository.Permissions().Check(ctx, userID, checks); err != nil {
		return oapi.MapError(err)
	}
	return nil
}

// canManage says whether the user may remove the app or its installations: the
// creator always can, and once the creator is gone an editor of the team it is shared with can
func (self *HandlerGroup) canManage(ctx context.Context, user *ent.User, app *ent.GithubApp) error {
	if app.CreatedBy != nil && *app.CreatedBy == user.ID {
		return nil
	}
	if app.CreatedBy == nil && app.TeamID != nil {
		return self.checkTeam(ctx, user.ID, *app.TeamID, schema.ActionEditor)
	}
	return huma.Error403Forbidden("Forbidden")
}

func RegisterHandlers(server *server.Server, grp *huma.Group) {
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
		OperationID: "set-app-team",
		Summary:     "Set App Team",
		Description: "Share a GitHub app with a team or make it private again. The creator picks any team they can edit; a team editor can only remove the app from their team.",
		Path:        "/app/team",
		Method:      http.MethodPut,
	}, handlers.HandleSetGithubAppTeam)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-app",
		Summary:     "Delete App",
		Description: "Remove a GitHub app and uninstall it from every account. Services built from it keep running but stop deploying on push. The app itself has to be deleted on GitHub.",
		Path:        "/app/delete",
		Method:      http.MethodDelete,
	}, handlers.HandleDeleteGithubApp, oapi.OpenWorld)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-app-installations",
		Summary:     "List Installations",
		Description: "List installations of the GitHub apps the caller can see.",
		Path:        "/installations",
		Method:      http.MethodGet,
	}, handlers.HandleListGithubAppInstallations)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-installation",
		Summary:     "Delete Installation",
		Description: "Uninstall a GitHub app from one account. Services built from it keep running but stop deploying on push. The row is removed even when GitHub cannot be reached.",
		Path:        "/installation/delete",
		Method:      http.MethodDelete,
	}, handlers.HandleDeleteGithubInstallation, oapi.OpenWorld)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-repositories",
		Summary:     "List Repositories",
		Description: "List the repositories reachable through the GitHub apps the caller can see. Per-user repository permissions are not verified.",
		Path:        "/repositories",
		Method:      http.MethodGet,
	}, handlers.HandleListGithubRepositories, oapi.OpenWorld)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "repo-detail",
		Summary:     "Repository Detail",
		Description: "Get a repository's branches and tags.",
		Path:        "/repositories/info",
		Method:      http.MethodGet,
	}, handlers.HandleGetGithubRepositoryDetail, oapi.OpenWorld)

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

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "app-save",
		Summary:     "Save GitHub App",
		Description: "GitHub app creation callback: exchanges the code, stores the app, and redirects to installation.",
		Path:        "/app/save",
		Method:      http.MethodGet,
	}, handlers.HandleGithubAppSave, oapi.Public, oapi.OpenWorld)
}
