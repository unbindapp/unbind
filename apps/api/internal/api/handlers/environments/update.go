package environments_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	environment_service "github.com/unbindapp/unbind-api/internal/services/environment"
)

type UpdateEnvironmentInput struct {
	server.BaseAuthInput
	Body *environment_service.UpdateEnvironmentInput
}

type UpdateEnvironmentResponse struct {
	Body struct {
		Data *models.EnvironmentResponse `json:"data"`
	}
}

func (self *HandlerGroup) UpdateEnvironment(ctx context.Context, input *UpdateEnvironmentInput) (*UpdateEnvironmentResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	updatedEnvironment, err := self.srv.EnvironmentService.UpdateEnvironment(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &UpdateEnvironmentResponse{}
	resp.Body.Data = updatedEnvironment
	return resp, nil
}
