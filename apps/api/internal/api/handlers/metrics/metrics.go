package metrics_handler

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
		OperationID: "get-metrics",
		Summary:     "Get Metrics",
		Description: "Get CPU, memory, network, and disk metrics for a team, project, environment, or service.",
		Path:        "/get",
		Method:      http.MethodGet,
	}, handlers.GetMetrics)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-system-metrics",
		Summary:     "Get System Metrics",
		Description: "Get cluster-level metrics (node, cluster, region).",
		Path:        "/get-system",
		Method:      http.MethodGet,
	}, handlers.GetNodeMetrics)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-volume-metrics",
		Summary:     "Get Volume Metrics",
		Description: "Get usage metrics for a persistent volume (PVC).",
		Path:        "/get-volume",
		Method:      http.MethodGet,
	}, handlers.GetVolumeMetrics)
}
