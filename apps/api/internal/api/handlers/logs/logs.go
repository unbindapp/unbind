package logs_handler

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/sse"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/infrastructure/loki"
)

type HandlerGroup struct {
	srv *server.Server
}

func RegisterHandlers(server *server.Server, grp *huma.Group) {
	handlers := &HandlerGroup{
		srv: server,
	}

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "query-logs",
		Summary:     "Query Logs",
		Description: "Query historical logs for a team, project, environment, service, or deployment.",
		Path:        "/query",
		Method:      http.MethodGet,
	}, handlers.QueryLogs)

	// SSE doesn't go through huma.Register, so apply the same docs manually.
	streamOp := huma.Operation{
		OperationID: "stream-logs",
		Method:      http.MethodGet,
		Path:        "/stream",
		Summary:     "Stream Logs",
		Description: "Stream live logs over Server-Sent Events. Errors are delivered as `message` events with an error type, not HTTP status codes.",
	}
	oapi.Apply(oapi.Read, &streamOp)
	sse.Register(grp, streamOp, map[string]any{
		// Mapping of event type name to Go struct for that event.
		"message": loki.LogEvents{},
	}, handlers.GetLogsfunc)
}

func (self *HandlerGroup) handleSSEErr(err error, send sse.Sender) {
	if errors.Is(err, errdefs.ErrInvalidInput) {
		_ = send.Data(
			loki.LogEvents{
				MessageType:  loki.LogEventsMessageTypeError,
				ErrorMessage: fmt.Sprintf("invalid input %v", err.Error()),
			},
		)
	}
	if errors.Is(err, errdefs.ErrUnauthorized) {
		_ = send.Data(
			loki.LogEvents{
				MessageType:  loki.LogEventsMessageTypeError,
				ErrorMessage: fmt.Sprintf("unauthorized %v", err.Error()),
			},
		)
	}
	if ent.IsNotFound(err) || errors.Is(err, errdefs.ErrNotFound) {
		_ = send.Data(
			loki.LogEvents{
				MessageType:  loki.LogEventsMessageTypeError,
				ErrorMessage: fmt.Sprintf("entity not found %v", err.Error()),
			},
		)
	}
	log.Error("Unknown error streaming logs", "err", err)
	_ = send.Data(
		loki.LogEvents{
			MessageType:  loki.LogEventsMessageTypeError,
			ErrorMessage: "An unexpected error occurred",
		},
	)
}
