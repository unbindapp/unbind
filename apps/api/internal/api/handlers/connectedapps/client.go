package connectedapps_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type GetClientInput struct {
	server.BaseAuthInput
	models.ConnectedAppClientInput
}

type GetClientResponse struct {
	Body struct {
		Data *models.ConnectedAppClientResponse `json:"data"`
	}
}

func (self *HandlerGroup) GetClient(ctx context.Context, input *GetClientInput) (*GetClientResponse, error) {
	if _, _, err := self.srv.AuthenticatedUser(ctx); err != nil {
		return nil, err
	}

	client, err := self.srv.OAuthServerService.ClientInfo(ctx, &input.ConnectedAppClientInput)
	if err != nil {
		return nil, oapi.MapError(asInputError(err))
	}

	resp := &GetClientResponse{}
	resp.Body.Data = client
	return resp, nil
}
