package auth_handler

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
	handlers := &HandlerGroup{srv: server}

	oapi.Register(grp, oapi.Invoke, huma.Operation{
		OperationID: "login",
		Summary:     "Login",
		Description: "Authenticate with email and password. On success, sets access and refresh session cookies.",
		Path:        "/login",
		Method:      http.MethodPost,
		Errors:      []int{http.StatusUnauthorized},
	}, handlers.Login, oapi.Public)

	oapi.Register(grp, oapi.Invoke, huma.Operation{
		OperationID: "logout",
		Summary:     "Logout",
		Description: "Revoke the current refresh token and clear the session cookies.",
		Path:        "/logout",
		Method:      http.MethodPost,
	}, handlers.Logout, oapi.Public)
}
