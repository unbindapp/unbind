package instances_handler

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
		OperationID: "list-instances",
		Summary:     "List Instances (Pods)",
		Description: "List the running instances (pods) for a service, environment, project, or team, with health status.",
		Path:        "/list",
		Method:      http.MethodGet,
	}, handlers.ListInstances)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-instance-health",
		Summary:     "Get Instance Health",
		Description: "Get the aggregated health/status of a service's instances.",
		Path:        "/health",
		Method:      http.MethodGet,
	}, handlers.GetInstanceHealth)

	oapi.Register(grp, oapi.Invoke, huma.Operation{
		OperationID: "restart-instances",
		Summary:     "Restart Instances (Pods)",
		Description: "Roll all of a service's instances (pods). Causes a brief disruption while pods restart.",
		Path:        "/restart",
		Method:      http.MethodPut,
	}, handlers.RestartInstances)
}
