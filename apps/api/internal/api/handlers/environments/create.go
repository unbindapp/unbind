package environments_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
	environment_service "github.com/unbindapp/unbind-api/internal/services/environment"
)

type CreateEnvironmentInput struct {
	server.BaseAuthInput
	Body *environment_service.CreateEnvironmentInput
}

type CreateEnvironmentResponse struct {
	Body struct {
		Data *models.EnvironmentResponse `json:"data"`
	}
}

func (self *HandlerGroup) CreateEnvironment(ctx context.Context, input *CreateEnvironmentInput) (*CreateEnvironmentResponse, error) {
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	createdEnvironment, err := self.srv.EnvironmentService.CreateEnvironment(ctx, user.ID, input.Body, bearerToken)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &CreateEnvironmentResponse{}
	resp.Body.Data = createdEnvironment
	return resp, nil
}
