package github_handler

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
)

type HandlerGroup struct {
	srv *server.Server
}

func RegisterHandlers(server *server.Server, grp *huma.Group) {
	handlers := &HandlerGroup{
		srv: server,
	}

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "app-create",
		Summary:     "Create App",
		Description: "Begin the GitHub app creation flow, returning the manifest to POST to GitHub.",
		Path:        "/app/create",
		Method:      http.MethodGet,
	}, handlers.HandleGithubAppCreate, oapi.OpenWorld)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-github-app",
		Summary:     "Get App",
		Description: "Get a connected GitHub app's details.",
		Path:        "/app/get",
		Method:      http.MethodGet,
	}, handlers.HandleGetGithubApp)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-apps",
		Summary:     "List Apps",
		Description: "List the GitHub apps connected to this instance.",
		Path:        "/apps",
		Method:      http.MethodGet,
	}, handlers.HandleListGithubApps)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-app-installations",
		Summary:     "List Installations",
		Description: "List installations across all connected GitHub apps.",
		Path:        "/installations",
		Method:      http.MethodGet,
	}, handlers.HandleListGithubAppInstallations)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-repositories",
		Summary:     "List Repositories",
		Description: "List all repositories accessible to the user's GitHub app installations. Per-user repository permissions are not verified.",
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
}
