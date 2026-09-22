package github_handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

type HandlerGroup struct {
	srv *server.Server
}

func (self *HandlerGroup) systemUser(ctx context.Context, action schema.PermittedAction) (*ent.User, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	checks := []permissions_repo.PermissionCheck{
		{Action: action, ResourceType: schema.ResourceTypeSystem},
	}
	if err := self.srv.Repository.Permissions().Check(ctx, user.ID, checks); err != nil {
		return nil, oapi.MapError(err)
	}
	return user, nil
}

func RegisterHandlers(server *server.Server, grp *huma.Group) {
	handlers := &HandlerGroup{
		srv: server,
	}

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "app-create",
		Summary:     "Create App",
		Description: "Begin the GitHub app creation flow, returning the manifest to POST to GitHub. Requires system editor access.",
		Path:        "/app/create",
		Method:      http.MethodGet,
	}, handlers.HandleGithubAppCreate, oapi.OpenWorld)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-github-app",
		Summary:     "Get App",
		Description: "Get a connected GitHub app's details. Requires system viewer access.",
		Path:        "/app/get",
		Method:      http.MethodGet,
	}, handlers.HandleGetGithubApp)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-apps",
		Summary:     "List Apps",
		Description: "List the GitHub apps connected to this instance. Requires system viewer access.",
		Path:        "/apps",
		Method:      http.MethodGet,
	}, handlers.HandleListGithubApps)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-app-installations",
		Summary:     "List Installations",
		Description: "List installations across all connected GitHub apps. Requires system viewer access.",
		Path:        "/installations",
		Method:      http.MethodGet,
	}, handlers.HandleListGithubAppInstallations)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-repositories",
		Summary:     "List Repositories",
		Description: "List all repositories accessible through the GitHub app installations connected to this instance. Per-user repository permissions are not verified.",
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
