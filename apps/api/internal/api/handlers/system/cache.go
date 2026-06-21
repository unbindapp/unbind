package system_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

// * Config
type RegistryCacheConfigResponse struct {
	Body struct {
		Data *models.RegistryCacheConfig `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) GetRegistryCacheConfig(ctx context.Context, input *server.BaseAuthInput) (*RegistryCacheConfigResponse, error) {
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}

	config, err := self.srv.SystemService.GetRegistryCacheConfig(ctx, user.ID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &RegistryCacheConfigResponse{}
	resp.Body.Data = config
	return resp, nil
}

// * Stats
type RegistryCacheStatsResponse struct {
	Body struct {
		Data *models.RegistryCacheStats `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) GetRegistryCacheStats(ctx context.Context, input *server.BaseAuthInput) (*RegistryCacheStatsResponse, error) {
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}

	stats, err := self.srv.SystemService.GetRegistryCacheStats(ctx, user.ID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &RegistryCacheStatsResponse{}
	resp.Body.Data = stats
	return resp, nil
}

// * Update
type UpdateRegistryCacheInput struct {
	server.BaseAuthInput
	Body models.UpdateRegistryCacheInput
}

func (self *HandlerGroup) UpdateRegistryCache(ctx context.Context, input *UpdateRegistryCacheInput) (*RegistryCacheConfigResponse, error) {
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}

	config, err := self.srv.SystemService.UpdateRegistryCache(ctx, user.ID, &input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &RegistryCacheConfigResponse{}
	resp.Body.Data = config
	return resp, nil
}
