package environments_handler

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
		OperationID: "get-environment",
		Summary:     "Get Environment",
		Description: "Get a single environment by ID.",
		Path:        "/get",
		Method:      http.MethodGet,
	}, handlers.GetEnvironment)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-environments",
		Summary:     "List Environments",
		Description: "List all environments in a project.",
		Path:        "/list",
		Method:      http.MethodGet,
	}, handlers.ListEnvironments)

	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "create-environment",
		Summary:     "Create Environment",
		Description: "Create a new environment in a project.",
		Path:        "/create",
		Method:      http.MethodPost,
	}, handlers.CreateEnvironment)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-environment",
		Summary:     "Update Environment",
		Description: "Update an environment's name or description.",
		Path:        "/update",
		Method:      http.MethodPut,
	}, handlers.UpdateEnvironment)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-environment",
		Summary:     "Delete Environment",
		Description: "Permanently delete an environment and its services. A project's last environment cannot be deleted.",
		Path:        "/delete",
		Method:      http.MethodDelete,
	}, handlers.DeleteEnvironment)
}
