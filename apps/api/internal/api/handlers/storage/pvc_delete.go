package storage_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type DeletePVCInput struct {
	server.BaseAuthInput
	Body *models.DeletePVCInput
}

type DeletePVCResponse struct {
	Body struct {
		Data server.DeletedResponse `json:"data"`
	}
}

func (self *HandlerGroup) DeletePVC(ctx context.Context, input *DeletePVCInput) (*DeletePVCResponse, error) {
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	err = self.srv.StorageService.DeletePVC(ctx, user.ID, bearerToken, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	response := &DeletePVCResponse{}
	response.Body.Data = server.DeletedResponse{
		ID:      input.Body.ID,
		Deleted: true,
	}
	return response, nil
}
