package storage_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type CreatePVCInput struct {
	server.BaseAuthInput
	Body *models.CreatePVCInput
}

type CreatePVCResponse struct {
	Body struct {
		Data *models.PVCInfo `json:"data"`
	}
}

func (self *HandlerGroup) CreatePVC(ctx context.Context, input *CreatePVCInput) (*CreatePVCResponse, error) {
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	pvc, err := self.srv.StorageService.CreatePVC(ctx, user.ID, bearerToken, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	response := &CreatePVCResponse{}
	response.Body.Data = pvc
	return response, nil
}
