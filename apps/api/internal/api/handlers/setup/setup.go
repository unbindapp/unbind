package setup_handler

// Handles initial bootstrapping requirements

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
		OperationID: "get-setup-status",
		Summary:     "Get Setup Status",
		Description: "Report whether Unbind has been bootstrapped with an initial user.",
		Path:        "/status",
		Method:      http.MethodGet,
	}, handlers.GetStatus, oapi.Public)

	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "create-bootstrap-user",
		Summary:     "Create Bootstrap User",
		Description: "Create the first admin user. Only valid before Unbind has been bootstrapped.",
		Path:        "/create-user",
		Method:      http.MethodPost,
	}, handlers.CreateUser, oapi.Public)
}
