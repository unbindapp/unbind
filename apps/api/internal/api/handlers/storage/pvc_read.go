package storage_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListPVCInput struct {
	server.BaseAuthInput
	models.ListPVCInput
}

type ListPVCResponse struct {
	Body struct {
		Data []*models.PVCInfo `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListPVCs(ctx context.Context, input *ListPVCInput) (*ListPVCResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}
	bearerToken, _ := self.srv.GetBearerTokenFromContext(ctx)

	pvcs, err := self.srv.StorageService.ListPVCs(ctx, user.ID, bearerToken, &input.ListPVCInput)
	if err != nil {
		return nil, oapi.MapError(err)
	}
	if len(pvcs) == 0 {
		pvcs = []*models.PVCInfo{}
	}

	response := &ListPVCResponse{}
	response.Body.Data = pvcs
	return response, nil
}

// * get by ID
type GetPVCInput struct {
	server.BaseAuthInput
	models.GetPVCInput
}

type GetPVCResponse struct {
	Body struct {
		Data *models.PVCInfo `json:"data"`
	}
}

func (self *HandlerGroup) GetPVC(ctx context.Context, input *GetPVCInput) (*GetPVCResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}
	bearerToken, _ := self.srv.GetBearerTokenFromContext(ctx)

	pvc, err := self.srv.StorageService.GetPVC(ctx, user.ID, bearerToken, &input.GetPVCInput)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	response := &GetPVCResponse{}
	response.Body.Data = pvc
	return response, nil
}
