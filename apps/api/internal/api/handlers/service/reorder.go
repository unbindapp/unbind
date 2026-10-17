package service_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
	service_service "github.com/unbindapp/unbind-api/internal/services/service"
)

type ReorderServicesInput struct {
	server.BaseAuthInput
	Body *service_service.ReorderServicesInput
}

type ReorderServicesResponse struct {
	Body struct {
		Data []*models.ServiceResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ReorderServices(ctx context.Context, input *ReorderServicesInput) (*ReorderServicesResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	services, err := self.srv.ServiceService.ReorderServices(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ReorderServicesResponse{}
	resp.Body.Data = services
	return resp, nil
}
