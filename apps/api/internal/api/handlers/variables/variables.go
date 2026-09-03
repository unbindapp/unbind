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
		Description: "List variables for a service, environment, project, or team. Service variables include their rendered values.",
		Path:        "/list",
		Method:      http.MethodGet,
	}, handlers.ListVariables)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-variables",
		Summary:     "Create or Update Variables",
		Description: "Upsert variables by key for a service, environment, project, or team. Values may contain ${{service.<id>.KEY}}, ${{team.KEY}}, ${{project.KEY}} and ${{environment.KEY}} references.",
		Path:        "/update",
		Method:      http.MethodPost,
	}, handlers.UpdateVariables)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-variables",
		Summary:     "Delete Variables",
		Description: "Delete variables by key from a service, environment, project, or team.",
		Path:        "/delete",
		Method:      http.MethodDelete,
	}, handlers.DeleteVariables)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-available-references",
		Summary:     "List Available Variable References",
		Description: "List the sources and keys a service's variables can reference.",
		Path:        "/references/available",
		Method:      http.MethodGet,
	}, handlers.ListReferenceableVariables)
}
