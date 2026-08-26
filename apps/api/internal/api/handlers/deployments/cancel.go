package deployments_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type CancelDeploymentInput struct {
	server.BaseAuthInput
	Body struct {
		models.CancelDeploymentInput
	}
}

type CancelDeploymentOutput struct {
	Body struct {
		Data *models.DeploymentResponse `json:"data"`
	}
}

func (self *HandlerGroup) CancelDeployment(ctx context.Context, input *CancelDeploymentInput) (*CancelDeploymentOutput, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	deployment, err := self.srv.DeploymentService.CancelDeployment(ctx, user.ID, &input.Body.CancelDeploymentInput)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &CancelDeploymentOutput{}
	resp.Body.Data = deployment
	return resp, nil
}
