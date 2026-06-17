package servicegroups_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
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
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	serviceGroup, err := self.srv.ServiceGroupService.UpdateServiceGroup(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &UpdateServiceGroupResponse{}
	resp.Body.Data = serviceGroup
	return resp, nil
}
