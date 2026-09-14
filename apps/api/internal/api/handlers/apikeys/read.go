package apikeys_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListAPIKeysInput struct {
	server.BaseAuthInput
	models.APIKeyListInput
}

type ListAPIKeysResponse struct {
	Body struct {
		Data []*models.APIKeyResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListAPIKeys(ctx context.Context, input *ListAPIKeysInput) (*ListAPIKeysResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	keys, err := self.srv.APIKeyService.List(ctx, user.ID, &input.APIKeyListInput)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListAPIKeysResponse{}
	resp.Body.Data = keys
	return resp, nil
}
