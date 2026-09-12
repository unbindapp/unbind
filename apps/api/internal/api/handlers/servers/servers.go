package servers_handler

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
		OperationID: "list-servers",
		Summary:     "List Servers",
		Description: "List the cluster's servers with their allocatable capacity, what is already requested on each, and pressure conditions.",
		Path:        "/list",
		Method:      http.MethodGet,
	}, handlers.ListServers)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-server",
		Summary:     "Get Server",
		Description: "Get a single server with its conditions, taints and hardware details.",
		Path:        "/get",
		Method:      http.MethodGet,
	}, handlers.GetServer)
}
