package deployments_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type RemoveDeploymentInput struct {
	server.BaseAuthInput
	Body struct {
		models.RemoveDeploymentInput
	}
}

type RemoveDeploymentOutput struct {
	Body struct {
		Data *models.DeploymentResponse `json:"data"`
	}
}

func (self *HandlerGroup) RemoveDeployment(ctx context.Context, input *RemoveDeploymentInput) (*RemoveDeploymentOutput, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	deployment, err := self.srv.DeploymentService.RemoveActiveDeployment(ctx, user.ID, &input.Body.RemoveDeploymentInput)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &RemoveDeploymentOutput{}
	resp.Body.Data = deployment
	return resp, nil
}
