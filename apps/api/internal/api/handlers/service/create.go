package service_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type CreateServiceInput struct {
	server.BaseAuthInput
	Body *models.CreateServiceInput
}

type CreateServiceResponse struct {
	Body struct {
		Data *models.ServiceResponse `json:"data"`
	}
}

func (self *HandlerGroup) CreateService(ctx context.Context, input *CreateServiceInput) (*CreateServiceResponse, error) {
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if input.Body == nil {
		return nil, huma.Error400BadRequest("Missing body")
	}

	createdService, err := self.srv.ServiceService.CreateService(ctx, user.ID, input.Body, bearerToken)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &CreateServiceResponse{}
	resp.Body.Data = createdService
	return resp, nil
}
