package teams_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
	team_service "github.com/unbindapp/unbind-api/internal/services/team"
)

type ListTeamMembersInput struct {
	server.BaseAuthInput
	TeamID uuid.UUID `query:"team_id" format:"uuid" required:"true"`
}

type ListTeamMembersResponse struct {
	Body struct {
		Data []*models.TeamMemberResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListTeamMembers(ctx context.Context, input *ListTeamMembersInput) (*ListTeamMembersResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	members, err := self.srv.TeamService.ListMembers(ctx, user.ID, input.TeamID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListTeamMembersResponse{}
	resp.Body.Data = members
	return resp, nil
}

type AddTeamMemberInput struct {
	server.BaseAuthInput
	Body *team_service.TeamMemberAddInput
}

type TeamMemberResponse struct {
	Body struct {
		Data *models.TeamMemberResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) AddTeamMember(ctx context.Context, input *AddTeamMemberInput) (*TeamMemberResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	member, err := self.srv.TeamService.AddMember(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &TeamMemberResponse{}
	resp.Body.Data = member
	return resp, nil
}

type UpdateTeamMemberInput struct {
	server.BaseAuthInput
	Body *team_service.TeamMemberRoleInput
}

func (self *HandlerGroup) UpdateTeamMember(ctx context.Context, input *UpdateTeamMemberInput) (*TeamMemberResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	member, err := self.srv.TeamService.UpdateMemberRole(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &TeamMemberResponse{}
	resp.Body.Data = member
	return resp, nil
}

type RemoveTeamMemberInput struct {
	server.BaseAuthInput
	Body *team_service.TeamMemberRemoveInput
}

type RemoveTeamMemberResponse struct {
	Body struct {
		Data server.SuccessResponse `json:"data"`
	}
}

func (self *HandlerGroup) RemoveTeamMember(ctx context.Context, input *RemoveTeamMemberInput) (*RemoveTeamMemberResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if err := self.srv.TeamService.RemoveMember(ctx, user.ID, input.Body); err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &RemoveTeamMemberResponse{}
	resp.Body.Data = server.SuccessResponse{Success: true}
	return resp, nil
}
