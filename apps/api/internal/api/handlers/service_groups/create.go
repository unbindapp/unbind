package servicegroups_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
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
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	createdServiceGroup, err := self.srv.ServiceGroupService.CreateServiceGroup(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &CreateServiceGroupResponse{}
	resp.Body.Data = createdServiceGroup
	return resp, nil
}
