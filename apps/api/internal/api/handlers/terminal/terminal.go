package terminal_handler

import (
	"context"
	"net/http"
	"slices"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	terminal_service "github.com/unbindapp/unbind-api/internal/services/terminal"
)

type HandlerGroup struct {
	srv      *server.Server
	upgrader websocket.Upgrader
}

type ExecInput struct {
	server.BaseAuthInput
	TeamID        uuid.UUID `query:"team_id" required:"true" format:"uuid"`
	ProjectID     uuid.UUID `query:"project_id" required:"true" format:"uuid"`
	EnvironmentID uuid.UUID `query:"environment_id" required:"true" format:"uuid"`
	ServiceID     uuid.UUID `query:"service_id" required:"true" format:"uuid"`
	PodName       string    `query:"pod_name" required:"false"`
	Container     string    `query:"container" required:"false"`
}

// RegisterHandlers documents the operation in the OpenAPI spec and routes it
// through the huma group. The upgrade itself runs inside a huma.StreamResponse,
// which hands the handler the raw response to hijack (allowedOrigins gates the
// upgrade in lieu of CSRF, which websockets can't carry).
func RegisterHandlers(srv *server.Server, grp *huma.Group, allowedOrigins []string) {
	handlers := &HandlerGroup{
		srv: srv,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				origin := r.Header.Get("Origin")
				return origin != "" && slices.Contains(allowedOrigins, origin)
			},
		},
	}

	op := huma.Operation{
		OperationID: "exec-terminal",
		Method:      http.MethodGet,
		Path:        "/exec",
		Summary:     "Exec Terminal",
		Description: "Upgrade to a WebSocket and attach an interactive shell to a service pod.",
		Responses: map[string]*huma.Response{
			"101": {Description: "Switching Protocols"},
		},
	}
	oapi.Apply(oapi.Invoke, &op)

	huma.Register(grp, op, handlers.Exec)
}

// Exec authorizes before the upgrade so denials surface as normal HTTP errors,
// then hijacks the connection and attaches the shell.
func (self *HandlerGroup) Exec(ctx context.Context, input *ExecInput) (*huma.StreamResponse, error) {
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}
	bearerToken, found := self.srv.GetBearerTokenFromContext(ctx)
	if !found {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}

	target, err := self.srv.TerminalService.Resolve(ctx, user.ID, bearerToken, &terminal_service.ExecInput{
		TeamID:        input.TeamID,
		ProjectID:     input.ProjectID,
		EnvironmentID: input.EnvironmentID,
		ServiceID:     input.ServiceID,
		PodName:       input.PodName,
		Container:     input.Container,
	})
	if err != nil {
		return nil, oapi.MapError(err)
	}

	return &huma.StreamResponse{
		Body: func(hctx huma.Context) {
			r, w := humachi.Unwrap(hctx)
			ws, err := self.upgrader.Upgrade(w, r, nil)
			if err != nil {
				log.Warnf("terminal websocket upgrade failed: %v", err)
				return
			}
			self.srv.TerminalService.Attach(r.Context(), ws, bearerToken, target)
		},
	}, nil
}
