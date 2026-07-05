package user_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListUserGroupsInput struct {
	server.BaseAuthInput
	UserID uuid.UUID `query:"user_id" format:"uuid" doc:"Defaults to the authenticated user when omitted"`
}

type ListUserGroupsResponse struct {
	Body struct {
		Data []*models.GroupResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListUserGroups(ctx context.Context, input *ListUserGroupsInput) (*ListUserGroupsResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	targetUserID := user.ID
	if input.UserID != uuid.Nil {
		targetUserID = input.UserID
	}

	groups, err := self.srv.GroupService.GetUserGroups(ctx, user.ID, targetUserID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListUserGroupsResponse{}
	resp.Body.Data = models.TransformGroupEntities(groups)
	return resp, nil
}
