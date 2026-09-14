package apikeys_handler

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

	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "create-api-key",
		Summary:     "Create API Key",
		Description: "Create an API key for the current user. Scopes must be within the user's own permissions. The token is returned once.",
		Path:        "/create",
		Method:      http.MethodPost,
	}, handlers.CreateAPIKey, oapi.Confirm)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-api-keys",
		Summary:     "List API Keys",
		Description: "List the current user's API keys, or another user's as a system admin. Tokens are never returned.",
		Path:        "/list",
		Method:      http.MethodGet,
	}, handlers.ListAPIKeys)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-api-key",
		Summary:     "Delete API Key",
		Description: "Revoke an API key. Owners can revoke their own keys, system admins can revoke any key.",
		Path:        "/delete",
		Method:      http.MethodDelete,
	}, handlers.DeleteAPIKey)
}
