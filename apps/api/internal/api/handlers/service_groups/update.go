package servicegroups_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type UpdateServiceGroupInput struct {
	server.BaseAuthInput
	Body *models.UpdateServiceGroupInput
}

type UpdateServiceGroupResponse struct {
	Body struct {
		Data *models.ServiceGroupResponse `json:"data"`
	}
}

func (self *HandlerGroup) UpdateServiceGroup(ctx context.Context, input *UpdateServiceGroupInput) (*UpdateServiceGroupResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	serviceGroup, err := self.srv.ServiceGroupService.UpdateServiceGroup(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &UpdateServiceGroupResponse{}
	resp.Body.Data = serviceGroup
	return resp, nil
}
