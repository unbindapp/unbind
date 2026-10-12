package teams_handler

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
		OperationID: "list-teams",
		Summary:     "List Teams",
		Description: "List the teams the current user can see.",
		Path:        "/list",
		Method:      http.MethodGet,
	}, handlers.ListTeams, oapi.MCP)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-team",
		Summary:     "Get Team",
		Description: "Get a single team by ID.",
		Path:        "/get",
		Method:      http.MethodGet,
	}, handlers.GetTeam, oapi.MCP)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-team",
		Summary:     "Update Team",
		Description: "Update a team's name or description.",
		Path:        "/update",
		Method:      http.MethodPut,
	}, handlers.UpdateTeam, oapi.NoMCP("Team settings are managed in the UI"))

	// Creating teams, deleting them and managing who is on them change
	// authorization, so like users and groups they are session only.
	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "create-team",
		Summary:     "Create Team",
		Description: "Create a team with its own namespace. Requires system admin. The creator becomes a team admin.",
		Path:        "/create",
		Method:      http.MethodPost,
	}, handlers.CreateTeam, oapi.SessionOnly)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "delete-team",
		Summary:     "Delete Team",
		Description: "Delete a team with every project, service, volume and bucket in it. Requires team admin.",
		Path:        "/delete",
		Method:      http.MethodDelete,
	}, handlers.DeleteTeam, oapi.SessionOnly)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-team-members",
		Summary:     "List Team Members",
		Description: "List who can reach the team: members with a role on it, and users who reach it through another group.",
		Path:        "/members",
		Method:      http.MethodGet,
	}, handlers.ListTeamMembers, oapi.SessionOnly)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "add-team-member",
		Summary:     "Add Team Member",
		Description: "Give an existing account a role on the team. Requires team admin.",
		Path:        "/members/add",
		Method:      http.MethodPost,
	}, handlers.AddTeamMember, oapi.SessionOnly)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "update-team-member",
		Summary:     "Update Team Member",
		Description: "Change a member's role on the team. Requires team admin.",
		Path:        "/members/update",
		Method:      http.MethodPut,
	}, handlers.UpdateTeamMember, oapi.SessionOnly)

	oapi.Register(grp, oapi.Update, huma.Operation{
		OperationID: "remove-team-member",
		Summary:     "Remove Team Member",
		Description: "Remove a member from the team. Requires team admin, or the member leaving on their own.",
		Path:        "/members/remove",
		Method:      http.MethodDelete,
	}, handlers.RemoveTeamMember, oapi.SessionOnly)

	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "invite-team-member",
		Summary:     "Invite Team Member",
		Description: "Invite an email address to the team. An existing account is added at once; a new one gets an invitation link, emailed when a mail relay is configured. Requires team admin.",
		Path:        "/members/invite",
		Method:      http.MethodPost,
	}, handlers.InviteTeamMember, oapi.SessionOnly)

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "list-team-invitations",
		Summary:     "List Team Invitations",
		Description: "List pending invitations to the team. Requires team admin.",
		Path:        "/invitations",
		Method:      http.MethodGet,
	}, handlers.ListTeamInvitations, oapi.SessionOnly)

	oapi.Register(grp, oapi.Delete, huma.Operation{
		OperationID: "revoke-team-invitation",
		Summary:     "Revoke Team Invitation",
		Description: "Revoke a pending invitation so its link stops working. Requires team admin.",
		Path:        "/invitations/revoke",
		Method:      http.MethodDelete,
	}, handlers.RevokeTeamInvitation, oapi.SessionOnly)
}
