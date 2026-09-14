package apikeys_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type CreateAPIKeyInput struct {
	server.BaseAuthInput
	Body *models.APIKeyCreateInput
}

type CreateAPIKeyResponse struct {
	Body struct {
		Data *models.APIKeyCreatedResponse `json:"data"`
	}
}

func (self *HandlerGroup) CreateAPIKey(ctx context.Context, input *CreateAPIKeyInput) (*CreateAPIKeyResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	key, err := self.srv.APIKeyService.Create(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &CreateAPIKeyResponse{}
	resp.Body.Data = key
	return resp, nil
}
