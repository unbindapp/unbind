package teams_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
	team_service "github.com/unbindapp/unbind-api/internal/services/team"
)

type InviteTeamMemberInput struct {
	server.BaseAuthInput
	Body *team_service.InviteMemberInput
}

type InviteTeamMemberResponse struct {
	Body struct {
		Data *models.InviteMemberResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) InviteTeamMember(ctx context.Context, input *InviteTeamMemberInput) (*InviteTeamMemberResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	result, err := self.srv.TeamService.InviteMember(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &InviteTeamMemberResponse{}
	resp.Body.Data = result
	return resp, nil
}

type ListTeamInvitationsInput struct {
	server.BaseAuthInput
	TeamID uuid.UUID `query:"team_id" format:"uuid" required:"true"`
}

type ListTeamInvitationsResponse struct {
	Body struct {
		Data []*models.InvitationResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListTeamInvitations(ctx context.Context, input *ListTeamInvitationsInput) (*ListTeamInvitationsResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	invitations, err := self.srv.TeamService.ListInvitations(ctx, user.ID, input.TeamID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListTeamInvitationsResponse{}
	resp.Body.Data = invitations
	return resp, nil
}

type RevokeTeamInvitationInput struct {
	server.BaseAuthInput
	Body *team_service.RevokeInvitationInput
}

type RevokeTeamInvitationResponse struct {
	Body struct {
		Data server.DeletedResponse `json:"data"`
	}
}

func (self *HandlerGroup) RevokeTeamInvitation(ctx context.Context, input *RevokeTeamInvitationInput) (*RevokeTeamInvitationResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if err := self.srv.TeamService.RevokeInvitation(ctx, user.ID, input.Body); err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &RevokeTeamInvitationResponse{}
	resp.Body.Data = server.DeletedResponse{ID: input.Body.InvitationID.String(), Deleted: true}
	return resp, nil
}
