package webhooks_handler

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
		OperationID: "create-webhook",
		Summary:     "Create Webhook",
		Description: "Register an outbound webhook for a team or project.",
		Path:        "/create",
		Method:      http.MethodPost,
	}, handlers.CreateWebhook, oapi.MCP)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-webhook",
		Summary:     "Update Webhook",
		Description: "Update an existing webhook's URL or events.",
		Path:        "/update",
		Method:      http.MethodPut,
	}, handlers.UpdateWebhook, oapi.MCP)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-webhook",
		Summary:     "Delete Webhook",
		Description: "Delete a webhook.",
		Path:        "/delete",
		Method:      http.MethodDelete,
	}, handlers.DeleteWebhook, oapi.MCP)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-webhooks",
		Summary:     "List Webhooks",
		Description: "List webhooks for a team or project. The URL is blank and url_redacted is true unless the connection has the webhook_urls capability.",
		Path:        "/list",
		Method:      http.MethodGet,
	}, handlers.ListWebhooks, oapi.MCP)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-webhook",
		Summary:     "Get Webhook",
		Description: "Get a single webhook by ID. The URL is blank and url_redacted is true unless the connection has the webhook_urls capability.",
		Path:        "/get",
		Method:      http.MethodGet,
	}, handlers.GetWebhook, oapi.MCP)
}
