package servicegroups_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type CreateServiceGroupInput struct {
	server.BaseAuthInput
	Body *models.CreateServiceGroupInput
}

type CreateServiceGroupResponse struct {
	Body struct {
		Data *models.ServiceGroupResponse `json:"data"`
	}
}

func (self *HandlerGroup) CreateServiceGroup(ctx context.Context, input *CreateServiceGroupInput) (*CreateServiceGroupResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	createdServiceGroup, err := self.srv.ServiceGroupService.CreateServiceGroup(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &CreateServiceGroupResponse{}
	resp.Body.Data = createdServiceGroup
	return resp, nil
}
