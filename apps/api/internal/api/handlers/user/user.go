package user_handler

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
		OperationID: "me",
		Summary:     "Get Current User",
		Description: "Get the authenticated user resolved from the session.",
		Path:        "/me",
		Method:      http.MethodGet,
	}, handlers.Me)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-users",
		Summary:     "List Users",
		Description: "List all users",
		Path:        "/list",
		Method:      http.MethodGet,
	}, handlers.ListUsers)

	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "create-user",
		Summary:     "Create User",
		Description: "Create a new user",
		Path:        "/create",
		Method:      http.MethodPost,
	}, handlers.CreateUser)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-user-password",
		Summary:     "Update User Password",
		Description: "Change your own password (requires current password) or another user's password (requires system admin)",
		Path:        "/update-password",
		Method:      http.MethodPut,
	}, handlers.UpdatePassword)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-user",
		Summary:     "Delete User",
		Description: "Delete a user",
		Path:        "/delete",
		Method:      http.MethodDelete,
	}, handlers.DeleteUser)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-user-groups",
		Summary:     "List User Groups",
		Description: "List the groups a user belongs to",
		Path:        "/groups",
		Method:      http.MethodGet,
	}, handlers.ListUserGroups)
}
