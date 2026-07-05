package groups_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
	group_service "github.com/unbindapp/unbind-api/internal/services/group"
)

type UpdateGroupInput struct {
	server.BaseAuthInput
	Body struct {
		GroupID     uuid.UUID `json:"group_id" format:"uuid" required:"true"`
		Name        string    `json:"name"`
		Description string    `json:"description"`
	}
}

type UpdateGroupResponse struct {
	Body struct {
		Data *models.GroupResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) UpdateGroup(ctx context.Context, input *UpdateGroupInput) (*UpdateGroupResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	group, err := self.srv.GroupService.UpdateGroup(ctx, user.ID, input.Body.GroupID, group_service.GroupCreateInput{
		Name:        input.Body.Name,
		Description: input.Body.Description,
	})
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &UpdateGroupResponse{}
	resp.Body.Data = models.TransformGroupEntity(group)
	return resp, nil
}
