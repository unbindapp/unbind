package deployments_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type RedeployInput struct {
	server.BaseAuthInput
	Body struct {
		models.RedeployExistingDeploymentInput
	}
}

type RedeployOutput struct {
	Body struct {
		Data *models.DeploymentResponse `json:"data"`
	}
}

func (self *HandlerGroup) CreateNewRedeployment(ctx context.Context, input *RedeployInput) (*RedeployOutput, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	deployment, err := self.srv.DeploymentService.CreateRedeployment(ctx, user.ID, &input.Body.RedeployExistingDeploymentInput)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &RedeployOutput{}
	resp.Body.Data = deployment
	return resp, nil
}
