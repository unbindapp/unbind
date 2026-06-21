package deployments_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type CreateBuildInput struct {
	server.BaseAuthInput
	Body struct {
		models.CreateDeploymentInput
	}
}

type CreateBuildOutput struct {
	Body struct {
		Data *models.DeploymentResponse `json:"data"`
	}
}

func (self *HandlerGroup) CreateDeployment(ctx context.Context, input *CreateBuildInput) (*CreateBuildOutput, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	buildJob, err := self.srv.DeploymentService.CreateManualDeployment(ctx, user.ID, &input.Body.CreateDeploymentInput)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &CreateBuildOutput{}
	resp.Body.Data = buildJob
	return resp, nil
}
