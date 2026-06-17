package webhook_handler

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

	oapi.Register(grp, oapi.Invoke, huma.Operation{
		OperationID: "github-webhook",
		Summary:     "GitHub Webhook",
		Description: "Receive GitHub webhook events. Authenticated by GitHub's signature header, not a session.",
		Path:        "/github",
		Method:      http.MethodPost,
	}, handlers.HandleGithubWebhook, oapi.Public)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "app-save",
		Summary:     "Save GitHub App",
		Description: "GitHub app creation callback: exchanges the code, stores the app, and redirects to installation.",
		Path:        "/github/app/save",
		Method:      http.MethodGet,
	}, handlers.HandleGithubAppSave, oapi.Public, oapi.OpenWorld)
}
