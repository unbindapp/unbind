package system_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

// * Create
type CreateRegistryInput struct {
	server.BaseAuthInput
	Body models.CreateRegistryInput
}

type CreateRegistryResponse struct {
	Body struct {
		Data *models.RegistryResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) CreateRegistry(ctx context.Context, input *CreateRegistryInput) (*CreateRegistryResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	registry, err := self.srv.SystemService.CreateRegistry(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &CreateRegistryResponse{}
	resp.Body.Data = registry
	return resp, nil
}

// * Delete
type DeleteRegistryInput struct {
	server.BaseAuthInput
	Body models.DeleteRegistryInput
}

func (self *HandlerGroup) DeleteRegistry(ctx context.Context, input *DeleteRegistryInput) (*server.DeletedResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	err = self.srv.SystemService.DeleteRegistry(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	return &server.DeletedResponse{
		ID:      input.Body.ID.String(),
		Deleted: true,
	}, nil
}

// * Get
type GetRegistryInput struct {
	server.BaseAuthInput
	models.GetRegistryInput
}

type GetRegistryResponse struct {
	Body struct {
		Data *models.RegistryResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) GetRegistry(ctx context.Context, input *GetRegistryInput) (*GetRegistryResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	registry, err := self.srv.SystemService.GetRegistry(ctx, user.ID, input.GetRegistryInput)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GetRegistryResponse{}
	resp.Body.Data = registry
	return resp, nil
}

// * List
type ListRegistriesResponse struct {
	Body struct {
		Data []*models.RegistryResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListRegistries(ctx context.Context, input *server.BaseAuthInput) (*ListRegistriesResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	registries, err := self.srv.SystemService.ListRegistries(ctx, user.ID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListRegistriesResponse{}
	resp.Body.Data = registries
	return resp, nil
}

// * Set default
type SetDefaultRegistryInput struct {
	server.BaseAuthInput
	Body models.SetDefaultRegistryInput
}

type SetDefaultRegistryResponse struct {
	Body struct {
		Data *models.RegistryResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) SetDefaultRegistry(ctx context.Context, input *SetDefaultRegistryInput) (*SetDefaultRegistryResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	registry, err := self.srv.SystemService.SetDefaultRegistry(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &SetDefaultRegistryResponse{}
	resp.Body.Data = registry
	return resp, nil
}
