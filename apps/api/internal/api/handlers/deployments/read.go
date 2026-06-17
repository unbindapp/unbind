package deployments_handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListDeploymentsInput struct {
	server.BaseAuthInput
	models.GetDeploymentsInput
}

type ListDeploymentResponseData struct {
	Deployments       []*models.DeploymentResponse       `json:"deployments"`
	CurrentDeployment *models.DeploymentResponse         `json:"current_deployment,omitempty"`
	Metadata          *models.PaginationResponseMetadata `json:"metadata"`
}

type ListDeploymentsResponse struct {
	Body struct {
		Data *ListDeploymentResponseData `json:"data"`
	}
}

func (self *HandlerGroup) ListDeployments(ctx context.Context, input *ListDeploymentsInput) (*ListDeploymentsResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	response, currentDeployment, metadata, err := self.srv.DeploymentService.GetDeploymentsForService(ctx, user.ID, &input.GetDeploymentsInput)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	return &ListDeploymentsResponse{
		Body: struct {
			Data *ListDeploymentResponseData `json:"data"`
		}{
			Data: &ListDeploymentResponseData{
				Deployments:       response,
				Metadata:          metadata,
				CurrentDeployment: currentDeployment,
			},
		},
	}, nil
}

// Get by ID
type GetDeploymentInput struct {
	server.BaseAuthInput
	models.GetDeploymentByIDInput
}

type GetDeploymentResponse struct {
	Body struct {
		Data *models.DeploymentResponse `json:"data"`
	}
}

func (self *HandlerGroup) GetDeploymentByID(ctx context.Context, input *GetDeploymentInput) (*GetDeploymentResponse, error) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		log.Error("Error getting user from context")
		return nil, huma.Error401Unauthorized("Unable to retrieve user")
	}

	deployment, err := self.srv.DeploymentService.GetDeploymentByID(ctx, user.ID, &input.GetDeploymentByIDInput)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	return &GetDeploymentResponse{
		Body: struct {
			Data *models.DeploymentResponse `json:"data"`
		}{
			Data: deployment,
		},
	}, nil
}
