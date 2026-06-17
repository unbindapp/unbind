package template_handler

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
		OperationID: "get-template",
		Summary:     "Get Template",
		Description: "Get a single template by ID, including its input schema.",
		Path:        "/get",
		Method:      http.MethodGet,
	}, handlers.GetTemplateByID)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-templates",
		Summary:     "List Available Templates",
		Description: "List all templates that can be deployed.",
		Path:        "/list",
		Method:      http.MethodGet,
	}, handlers.ListTemplates)

	oapi.Register(grp, oapi.Invoke, huma.Operation{
		OperationID: "deploy-template",
		Summary:     "Deploy Template",
		Description: "Create and deploy the services defined by a template into an environment. Queues asynchronous builds.",
		Path:        "/deploy",
		Method:      http.MethodPost,
	}, handlers.DeployTemplate, oapi.OpenWorld)
}
