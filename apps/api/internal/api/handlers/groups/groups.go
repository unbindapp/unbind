package groups_handler

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
		OperationID: "list-groups",
		Summary:     "List Groups",
		Description: "List all groups",
		Path:        "/list",
		Method:      http.MethodGet,
	}, handlers.ListGroups)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-group",
		Summary:     "Get Group",
		Description: "Get a group by ID",
		Path:        "/get",
		Method:      http.MethodGet,
	}, handlers.GetGroup)

	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "create-group",
		Summary:     "Create Group",
		Description: "Create a new group",
		Path:        "/create",
		Method:      http.MethodPost,
	}, handlers.CreateGroup)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-group",
		Summary:     "Update Group",
		Description: "Update a group",
		Path:        "/update",
		Method:      http.MethodPut,
	}, handlers.UpdateGroup)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-group",
		Summary:     "Delete Group",
		Description: "Delete a group",
		Path:        "/delete",
		Method:      http.MethodDelete,
	}, handlers.DeleteGroup)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-group-members",
		Summary:     "List Group Members",
		Description: "List all members of a group",
		Path:        "/members",
		Method:      http.MethodGet,
	}, handlers.ListGroupMembers)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "add-group-member",
		Summary:     "Add Group Member",
		Description: "Add a user to a group",
		Path:        "/members/add",
		Method:      http.MethodPost,
	}, handlers.AddGroupMember)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "remove-group-member",
		Summary:     "Remove Group Member",
		Description: "Remove a user from a group",
		Path:        "/members/remove",
		Method:      http.MethodDelete,
	}, handlers.RemoveGroupMember)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-group-permissions",
		Summary:     "List Group Permissions",
		Description: "List all permissions granted to a group",
		Path:        "/permissions",
		Method:      http.MethodGet,
	}, handlers.ListGroupPermissions)

	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "grant-group-permission",
		Summary:     "Grant Group Permission",
		Description: "Grant a permission to a group",
		Path:        "/permissions/grant",
		Method:      http.MethodPost,
	}, handlers.GrantGroupPermission)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "revoke-group-permission",
		Summary:     "Revoke Group Permission",
		Description: "Revoke a permission from a group",
		Path:        "/permissions/revoke",
		Method:      http.MethodDelete,
	}, handlers.RevokeGroupPermission)
}
