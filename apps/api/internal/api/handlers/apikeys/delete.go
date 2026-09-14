package apikeys_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type DeleteAPIKeyInput struct {
	server.BaseAuthInput
	Body *models.APIKeyDeleteInput
}

type DeleteAPIKeyResponse struct {
	Body struct {
		Data server.DeletedResponse `json:"data"`
	}
}

func (self *HandlerGroup) DeleteAPIKey(ctx context.Context, input *DeleteAPIKeyInput) (*DeleteAPIKeyResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if err := self.srv.APIKeyService.Delete(ctx, user.ID, input.Body.ID); err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &DeleteAPIKeyResponse{}
	resp.Body.Data = server.DeletedResponse{
		ID:      input.Body.ID.String(),
		Deleted: true,
	}
	return resp, nil
}
