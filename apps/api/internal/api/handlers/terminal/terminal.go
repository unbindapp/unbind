package terminal_handler

import (
	"errors"
	"net/http"
	"slices"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/api/middleware"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	terminal_service "github.com/unbindapp/unbind-api/internal/services/terminal"
)

type HandlerGroup struct {
	srv      *server.Server
	upgrader websocket.Upgrader
}

// allowedOrigins gates the upgrade in lieu of CSRF, which websockets can't carry.
func NewHandler(srv *server.Server, allowedOrigins []string) *HandlerGroup {
	return &HandlerGroup{
		srv: srv,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				origin := r.Header.Get("Origin")
				if origin == "" {
					return false
				}
				return slices.Contains(allowedOrigins, origin)
			},
		},
	}
}

// Exec authorizes, upgrades to a websocket, and attaches a shell to the target pod.
func (self *HandlerGroup) Exec(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromRequest(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	bearerToken, ok := middleware.BearerTokenFromRequest(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	input, err := parseExecInput(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	target, err := self.srv.TerminalService.Resolve(r.Context(), user.ID, bearerToken, input)
	if err != nil {
		status, message := httpErrorFor(err)
		http.Error(w, message, status)
		return
	}

	ws, err := self.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Warnf("terminal websocket upgrade failed: %v", err)
		return
	}

	self.srv.TerminalService.Attach(r.Context(), ws, bearerToken, target)
}

func parseExecInput(r *http.Request) (*terminal_service.ExecInput, error) {
	q := r.URL.Query()

	teamID, err := uuid.Parse(q.Get("team_id"))
	if err != nil {
		return nil, errInvalid("team_id")
	}
	projectID, err := uuid.Parse(q.Get("project_id"))
	if err != nil {
		return nil, errInvalid("project_id")
	}
	environmentID, err := uuid.Parse(q.Get("environment_id"))
	if err != nil {
		return nil, errInvalid("environment_id")
	}
	serviceID, err := uuid.Parse(q.Get("service_id"))
	if err != nil {
		return nil, errInvalid("service_id")
	}

	return &terminal_service.ExecInput{
		TeamID:        teamID,
		ProjectID:     projectID,
		EnvironmentID: environmentID,
		ServiceID:     serviceID,
		PodName:       q.Get("pod_name"),
		Container:     q.Get("container"),
	}, nil
}

func errInvalid(field string) error {
	return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Invalid or missing "+field)
}

func httpErrorFor(err error) (int, string) {
	var ce *errdefs.CustomError
	switch {
	case errors.As(err, &ce):
		switch ce.Type {
		case errdefs.ErrTypeInvalidInput:
			return http.StatusBadRequest, ce.Message
		case errdefs.ErrTypeNotFound:
			return http.StatusNotFound, ce.Message
		case errdefs.ErrTypeConflict:
			return http.StatusConflict, ce.Message
		}
	case errors.Is(err, errdefs.ErrUnauthorized):
		return http.StatusForbidden, "Forbidden"
	case ent.IsNotFound(err):
		return http.StatusNotFound, "Not found"
	}
	log.Errorf("terminal: unhandled error: %v", err)
	return http.StatusInternalServerError, "Internal server error"
}
