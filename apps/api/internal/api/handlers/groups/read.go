package groups_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListGroupsResponse struct {
	Body struct {
		Data []*models.GroupResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListGroups(ctx context.Context, input *server.BaseAuthInput) (*ListGroupsResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	groups, err := self.srv.GroupService.ListGroups(ctx, user.ID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListGroupsResponse{}
	resp.Body.Data = models.TransformGroupEntities(groups)
	return resp, nil
}

type GetGroupInput struct {
	server.BaseAuthInput
	GroupID uuid.UUID `query:"group_id" format:"uuid" required:"true"`
}

type GetGroupResponse struct {
	Body struct {
		Data *models.GroupResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) GetGroup(ctx context.Context, input *GetGroupInput) (*GetGroupResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	group, err := self.srv.GroupService.GetGroupByID(ctx, user.ID, input.GroupID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GetGroupResponse{}
	resp.Body.Data = models.TransformGroupEntity(group)
	return resp, nil
}
