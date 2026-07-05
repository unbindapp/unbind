package groups_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
)

type DeleteGroupInput struct {
	server.BaseAuthInput
	Body struct {
		GroupID uuid.UUID `json:"group_id" format:"uuid" required:"true"`
	}
}

type DeleteGroupResponse struct {
	Body struct {
		Data server.DeletedResponse `json:"data"`
	}
}

func (self *HandlerGroup) DeleteGroup(ctx context.Context, input *DeleteGroupInput) (*DeleteGroupResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if err := self.srv.GroupService.DeleteGroup(ctx, user.ID, input.Body.GroupID); err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &DeleteGroupResponse{}
	resp.Body.Data = server.DeletedResponse{
		ID:      input.Body.GroupID.String(),
		Deleted: true,
	}
	return resp, nil
}
