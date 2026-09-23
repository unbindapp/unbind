package variables_handler

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
		OperationID: "list-variables",
		Summary:     "List Variables",
		Description: "List variables for a service, environment, project, or team. Service variables include their rendered values. Values are blank and values_redacted is true unless the connection has the read_variable_values capability; names and references are always listed.",
		Path:        "/list",
		Method:      http.MethodGet,
	}, handlers.ListVariables, oapi.MCP)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-variables",
		Summary:     "Create or Update Variables",
		Description: "Upsert variables by key for a service, environment, project, or team. Values may contain ${{service.<id>.KEY}}, ${{team.KEY}}, ${{project.KEY}} and ${{environment.KEY}} references. A service's protected_variables, such as database credentials, are managed by Unbind and cannot be changed.",
		Path:        "/update",
		Method:      http.MethodPost,
	}, handlers.UpdateVariables, oapi.MCP)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-variables",
		Summary:     "Delete Variables",
		Description: "Delete variables by key from a service, environment, project, or team. A service's protected_variables cannot be deleted.",
		Path:        "/delete",
		Method:      http.MethodDelete,
	}, handlers.DeleteVariables, oapi.MCP)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-available-references",
		Summary:     "List Available Variable References",
		Description: "List the sources and keys a service's variables can reference.",
		Path:        "/references/available",
		Method:      http.MethodGet,
	}, handlers.ListReferenceableVariables, oapi.MCP)
}
