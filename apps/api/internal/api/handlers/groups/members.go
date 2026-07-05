package groups_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListGroupMembersInput struct {
	server.BaseAuthInput
	GroupID uuid.UUID `query:"group_id" format:"uuid" required:"true"`
}

type ListGroupMembersResponse struct {
	Body struct {
		Data []*models.UserResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListGroupMembers(ctx context.Context, input *ListGroupMembersInput) (*ListGroupMembersResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	members, err := self.srv.GroupService.GetGroupMembers(ctx, user.ID, input.GroupID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListGroupMembersResponse{}
	resp.Body.Data = models.TransformUserEntities(members)
	return resp, nil
}

type GroupMemberInput struct {
	server.BaseAuthInput
	Body struct {
		GroupID uuid.UUID `json:"group_id" format:"uuid" required:"true"`
		UserID  uuid.UUID `json:"user_id" format:"uuid" required:"true"`
	}
}

type GroupMemberResponse struct {
	Body struct {
		Data server.SuccessResponse `json:"data"`
	}
}

func (self *HandlerGroup) AddGroupMember(ctx context.Context, input *GroupMemberInput) (*GroupMemberResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if err := self.srv.GroupService.AddUserToGroup(ctx, user.ID, input.Body.UserID, input.Body.GroupID); err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GroupMemberResponse{}
	resp.Body.Data = server.SuccessResponse{Success: true}
	return resp, nil
}

func (self *HandlerGroup) RemoveGroupMember(ctx context.Context, input *GroupMemberInput) (*GroupMemberResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if err := self.srv.GroupService.RemoveUserFromGroup(ctx, user.ID, input.Body.UserID, input.Body.GroupID); err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GroupMemberResponse{}
	resp.Body.Data = server.SuccessResponse{Success: true}
	return resp, nil
}
