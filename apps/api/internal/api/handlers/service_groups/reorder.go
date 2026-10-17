package servicegroups_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
	service_service "github.com/unbindapp/unbind-api/internal/services/service"
)

type ReorderServiceGroupInput struct {
	server.BaseAuthInput
	Body *service_service.ReorderServiceGroupInput
}

type ReorderServiceGroupResponse struct {
	Body struct {
		Data []*models.ServiceResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ReorderServiceGroup(ctx context.Context, input *ReorderServiceGroupInput) (*ReorderServiceGroupResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	services, err := self.srv.ServiceService.ReorderServiceGroup(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ReorderServiceGroupResponse{}
	resp.Body.Data = services
	return resp, nil
}
