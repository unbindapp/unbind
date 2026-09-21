package replicas_handler

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
		OperationID: "list-replicas",
		Summary:     "List Replicas (Pods)",
		Description: "List the running replicas (pods) for a service, environment, project, or team, with health status. Send the ID of the level named by type along with the IDs of every level above it.",
		Path:        "/list",
		Method:      http.MethodGet,
	}, handlers.ListReplicas, oapi.MCP)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-replica-health",
		Summary:     "Get Replica (Pod) Health",
		Description: "Get the aggregated health/status of a service's replicas (pods).",
		Path:        "/health",
		Method:      http.MethodGet,
	}, handlers.GetReplicaHealth, oapi.MCP)

	oapi.Register(grp, oapi.Invoke, huma.Operation{
		OperationID: "restart-replicas",
		Summary:     "Restart Replicas (Pods)",
		Description: "Roll all of a service's replicas (pods). Causes a brief disruption while pods restart.",
		Path:        "/restart",
		Method:      http.MethodPut,
	}, handlers.RestartReplicas, oapi.MCP)
}
