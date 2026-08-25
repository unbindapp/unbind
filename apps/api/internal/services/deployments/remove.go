package deployments_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// RemoveActiveDeployment scales the service to zero without deleting anything, any new deployment brings it back.
func (self *DeploymentService) RemoveActiveDeployment(ctx context.Context, requesterUserId uuid.UUID, input *models.RemoveDeploymentInput) (*models.DeploymentResponse, error) {
	// Editor can remove deployments
	if err := self.repo.Permissions().Check(ctx, requesterUserId, []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeService,
			ResourceID:   input.ServiceID,
		},
	}); err != nil {
		return nil, err
	}

	service, err := self.validateInputs(ctx, input)
	if err != nil {
		return nil, err
	}

	if service.Type == schema.ServiceTypeDatabase {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Removing the active deployment is not supported for databases")
	}

	if service.CurrentDeploymentID == nil || *service.CurrentDeploymentID != input.DeploymentID {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Deployment is not the active deployment")
	}

	deployment := service.Edges.CurrentDeployment
	if deployment == nil || deployment.ResourceDefinition == nil {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Deployment has no resource definition")
	}

	envVars, err := self.resolveReferences(ctx, service)
	if err != nil {
		return nil, err
	}

	crd := self.CreateCRDFromService(service)
	crd.Spec.DeploymentRef = deployment.ID.String()
	crd.Spec.EnvVars = envVars
	crd.Spec.Config.Replicas = new(int32(0))

	if _, _, err := self.k8s.DeployUnbindService(ctx, crd); err != nil {
		return nil, err
	}

	removed, err := self.repo.Deployment().MarkRemoved(ctx, nil, deployment.ID, crd)
	if err != nil {
		return nil, err
	}

	return models.TransformDeploymentEntity(removed), nil
}
