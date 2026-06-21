package service_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type UpdateServiceInput struct {
	server.BaseAuthInput
	Body *models.UpdateServiceInput
}

type UpdatServiceResponse struct {
	Body struct {
		Data *models.ServiceResponse `json:"data"`
	}
}

func (self *HandlerGroup) UpdateService(ctx context.Context, input *UpdateServiceInput) (*UpdatServiceResponse, error) {
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	service, err := self.srv.ServiceService.UpdateService(ctx, user.ID, bearerToken, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &UpdatServiceResponse{}
	resp.Body.Data = service
	return resp, nil
}
