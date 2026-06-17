package teams_handler

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
		OperationID: "list-teams",
		Summary:     "List Teams",
		Description: "List all teams the current user belongs to.",
		Path:        "/list",
		Method:      http.MethodGet,
	}, handlers.ListTeams)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-team",
		Summary:     "Get Team",
		Description: "Get a single team by ID.",
		Path:        "/get",
		Method:      http.MethodGet,
	}, handlers.GetTeam)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-team",
		Summary:     "Update Team",
		Description: "Update a team's name or description.",
		Path:        "/update",
		Method:      http.MethodPut,
	}, handlers.UpdateTeam)
}
