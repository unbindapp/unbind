package deployments_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
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
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	// Create build job
	buildJob, err := self.srv.DeploymentService.CreateManualDeployment(ctx, user.ID, &input.Body.CreateDeploymentInput)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &CreateBuildOutput{}
	resp.Body.Data = buildJob
	return resp, nil
}
