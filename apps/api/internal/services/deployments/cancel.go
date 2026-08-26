package deployments_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// CancelDeployment aborts a queued or running build.
func (self *DeploymentService) CancelDeployment(ctx context.Context, requesterUserId uuid.UUID, input *models.CancelDeploymentInput) (*models.DeploymentResponse, error) {
	// Editor can cancel deployments
	if err := self.repo.Permissions().Check(ctx, requesterUserId, []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeService,
			ResourceID:   input.ServiceID,
		},
	}); err != nil {
		return nil, err
	}

	if _, err := self.validateInputs(ctx, input); err != nil {
		return nil, err
	}

	cancelled, err := self.deploymentController.CancelDeployment(ctx, input.ServiceID, input.DeploymentID)
	if err != nil {
		return nil, err
	}

	return models.TransformDeploymentEntity(cancelled), nil
}
