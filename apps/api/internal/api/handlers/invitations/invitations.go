// Package invitations_handler serves the public side of team invitations: the
// invitee holds a token and nothing else, so these routes take no session.
package invitations_handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
	team_service "github.com/unbindapp/unbind-api/internal/services/team"
)

type HandlerGroup struct {
	srv *server.Server
}

func RegisterHandlers(server *server.Server, grp *huma.Group) {
	handlers := &HandlerGroup{srv: server}

	oapi.Register(grp, oapi.Read, huma.Operation{
		OperationID: "get-invitation",
		Summary:     "Get Invitation",
		Description: "Show who an invitation is for and what it grants, before it is accepted.",
		Path:        "/get",
		Method:      http.MethodGet,
	}, handlers.GetInvitation, oapi.Public)

	oapi.Register(grp, oapi.Create, huma.Operation{
		OperationID: "accept-invitation",
		Summary:     "Accept Invitation",
		Description: "Accept an invitation. Creates the account when the invited email has none, then adds it to the team.",
		Path:        "/accept",
		Method:      http.MethodPost,
	}, handlers.AcceptInvitation, oapi.Public)
}

type GetInvitationInput struct {
	Token string `query:"token" required:"true" minLength:"1"`
}

type GetInvitationResponse struct {
	Body struct {
		Data *models.InvitationPreviewResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) GetInvitation(ctx context.Context, input *GetInvitationInput) (*GetInvitationResponse, error) {
	preview, err := self.srv.TeamService.GetInvitation(ctx, input.Token)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GetInvitationResponse{}
	resp.Body.Data = preview
	return resp, nil
}

type AcceptInvitationInput struct {
	Body *team_service.AcceptInvitationInput
}

type AcceptInvitationResponse struct {
	Body struct {
		Data *models.UserResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) AcceptInvitation(ctx context.Context, input *AcceptInvitationInput) (*AcceptInvitationResponse, error) {
	user, err := self.srv.TeamService.AcceptInvitation(ctx, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &AcceptInvitationResponse{}
	resp.Body.Data = user
	return resp, nil
}
