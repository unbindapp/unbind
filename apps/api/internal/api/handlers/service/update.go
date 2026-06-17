package service_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
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
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}
	bearerToken, _ := self.srv.GetBearerTokenFromContext(ctx)

	service, err := self.srv.ServiceService.UpdateService(ctx, user.ID, bearerToken, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &UpdatServiceResponse{}
	resp.Body.Data = service
	return resp, nil
}
