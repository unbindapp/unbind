package environments_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
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
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	updatedEnvironment, err := self.srv.EnvironmentService.UpdateEnvironment(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &UpdateEnvironmentResponse{}
	resp.Body.Data = updatedEnvironment
	return resp, nil
}
