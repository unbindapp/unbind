package cron_handler

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
		OperationID: "list-cron-runs",
		Summary:     "List Cron Runs",
		Description: "List the runs of a service that has a cron schedule, newest first. Scheduled and manual runs are listed for as long as the cluster keeps them, with their status, timing and failure reason. Use the run's name to find its logs.",
		Path:        "/runs",
		Method:      http.MethodGet,
	}, handlers.ListCronRuns, oapi.MCP)

	oapi.Register(grp, oapi.Invoke, huma.Operation{
		OperationID: "start-cron-run",
		Summary:     "Start Cron Run",
		Description: "Start a run of a service that has a cron schedule right now, outside its schedule. Refused while another run is in progress, and until the schedule has been deployed.",
		Path:        "/run",
		Method:      http.MethodPost,
	}, handlers.StartCronRun, oapi.MCP)
}
