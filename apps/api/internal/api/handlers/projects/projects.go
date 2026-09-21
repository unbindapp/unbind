package projects_handler

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
		OperationID: "create-project",
		Summary:     "Create Project",
		Description: "Create a project within a team.",
		Path:        "/create",
		Method:      http.MethodPost,
	}, handlers.CreateProject, oapi.MCP)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-projects",
		Summary:     "List Projects",
		Description: "List all projects in a team.",
		Path:        "/list",
		Method:      http.MethodGet,
	}, handlers.ListProjects, oapi.MCP)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-project",
		Summary:     "Get Project",
		Description: "Get a single project by ID.",
		Path:        "/get",
		Method:      http.MethodGet,
	}, handlers.GetProject, oapi.MCP)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-project",
		Summary:     "Update Project",
		Description: "Update a project's name, description, or default environment.",
		Path:        "/update",
		Method:      http.MethodPut,
	}, handlers.UpdateProject, oapi.MCP)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-project",
		Summary:     "Delete Project",
		Description: "Permanently delete a project and every environment, service, volume, and deployment inside it.",
		Path:        "/delete",
		Method:      http.MethodDelete,
	}, handlers.DeleteProject, oapi.MCP)
}
