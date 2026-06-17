package deployments_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
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
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	// Create deployment
	deployment, err := self.srv.DeploymentService.CreateRedeployment(ctx, user.ID, &input.Body.RedeployExistingDeploymentInput)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &RedeployOutput{}
	resp.Body.Data = deployment
	return resp, nil
}
