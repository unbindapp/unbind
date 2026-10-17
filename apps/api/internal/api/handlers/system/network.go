package system_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type NetworkSettingsResponse struct {
	Body struct {
		Data *models.NetworkSettingsResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) GetNetworkSettings(ctx context.Context, input *server.BaseAuthInput) (*NetworkSettingsResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	settings, err := self.srv.NetworkService.GetSettings(ctx, user.ID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &NetworkSettingsResponse{}
	resp.Body.Data = settings
	return resp, nil
}

type UpdateNetworkSettingsInput struct {
	server.BaseAuthInput
	Body *models.UpdateNetworkSettingsInput
}

func (self *HandlerGroup) UpdateNetworkSettings(ctx context.Context, input *UpdateNetworkSettingsInput) (*NetworkSettingsResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	settings, err := self.srv.NetworkService.UpdateSettings(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &NetworkSettingsResponse{}
	resp.Body.Data = settings
	return resp, nil
}

type ListNetworkServicesResponse struct {
	Body struct {
		Data []*models.NetworkServiceResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListNetworkServices(ctx context.Context, input *server.BaseAuthInput) (*ListNetworkServicesResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	services, err := self.srv.NetworkService.ListServices(ctx, user.ID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListNetworkServicesResponse{}
	resp.Body.Data = services
	return resp, nil
}

type CreateNetworkExceptionInput struct {
	server.BaseAuthInput
	Body *models.CreateNetworkExceptionInput
}

type CreateNetworkExceptionResponse struct {
	Body struct {
		Data *models.NetworkExceptionResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) CreateNetworkException(ctx context.Context, input *CreateNetworkExceptionInput) (*CreateNetworkExceptionResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	exception, err := self.srv.NetworkService.CreateException(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &CreateNetworkExceptionResponse{}
	resp.Body.Data = exception
	return resp, nil
}

type DeleteNetworkExceptionInput struct {
	server.BaseAuthInput
	Body *models.DeleteNetworkExceptionInput
}

func (self *HandlerGroup) DeleteNetworkException(ctx context.Context, input *DeleteNetworkExceptionInput) (*server.DeletedResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if err := self.srv.NetworkService.DeleteException(ctx, user.ID, input.Body); err != nil {
		return nil, oapi.MapError(err)
	}

	return &server.DeletedResponse{
		ID:      input.Body.ID.String(),
		Deleted: true,
	}, nil
}
