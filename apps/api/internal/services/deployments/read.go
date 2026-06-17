package deployments_service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *DeploymentService) GetDeploymentsForService(ctx context.Context, requesterUserId uuid.UUID, input *models.GetDeploymentsInput) ([]*models.DeploymentResponse, *models.DeploymentResponse, *models.PaginationResponseMetadata, error) {
	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserId, []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeService,
			ResourceID:   input.ServiceID,
		},
	}); err != nil {
		return nil, nil, nil, err
	}

	service, err := self.validateInputs(ctx, input)
	if err != nil {
		return nil, nil, nil, err
	}

	// Huma doesn't support pointers in query so we need to convert zero's to nil
	var cursor *time.Time
	if !input.Cursor.IsZero() {
		cursor = &input.Cursor
	}
	// Get build jobs
	deployments, nextCursor, err := self.repo.Deployment().GetByServiceIDPaginated(ctx, input.ServiceID, input.PerPage, cursor, input.Statuses)
	if err != nil {
		return nil, nil, nil, err
	}

	if err != nil {
		return nil, nil, nil, err
	}

	// Transform response
	resp := models.TransformDeploymentEntities(deployments)

	currentDeployment, err := self.AttachInstanceDataToCurrent(ctx, resp, service)
	if err != nil {
		log.Error("Error attaching instance data to current deployment", "err", err, "service_id", service.ID)
		return nil, nil, nil, err
	}

	// Get pagination metadata
	metadata := &models.PaginationResponseMetadata{
		HasNext:        nextCursor != nil,
		NextCursor:     nextCursor,
		PreviousCursor: cursor,
	}

	return resp, currentDeployment, metadata, nil
}

func (self *DeploymentService) GetDeploymentByID(ctx context.Context, requesterUserId uuid.UUID, input *models.GetDeploymentByIDInput) (*models.DeploymentResponse, error) {
	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserId, []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionViewer,
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

	// Get deployment
	deployment, err := self.repo.Deployment().GetByID(ctx, input.DeploymentID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, input.DeploymentID.String())
		}
		return nil, err
	}

	if service.CurrentDeploymentID != nil && *service.CurrentDeploymentID == deployment.ID {
		// If this is the current deployment, attach instance data
		return self.AttachInstanceDataToCurrent(ctx, []*models.DeploymentResponse{models.TransformDeploymentEntity(deployment)}, service)
	}

	transformed := models.TransformDeploymentEntity(deployment)
	if service.CurrentDeploymentID != nil && transformed.Status == schema.DeploymentStatusBuildSucceeded {
		// If this has been built and a different deployment is active, infer it was removed
		transformed.Status = schema.DeploymentStatusRemoved
	}

	return transformed, nil
}

// Attach instance data
func (self *DeploymentService) AttachInstanceDataToCurrent(ctx context.Context, deployments []*models.DeploymentResponse, service *ent.Service) (*models.DeploymentResponse, error) {
	if service.Edges.CurrentDeployment == nil {
		return nil, nil
	}
	targetDeployment := models.TransformDeploymentEntity(service.Edges.CurrentDeployment)

	namespace := service.Edges.Environment.Edges.Project.Edges.Team.Namespace
	statuses, err := self.k8s.GetPodContainerStatusByLabelsWithOptions(
		ctx,
		namespace,
		map[string]string{
			"unbind-service": service.ID.String(),
		},
		self.k8s.GetInternalClient(),
		k8s.PodStatusOptions{
			IncludeKubernetesEvents: false, // Skip expensive Kubernetes Events API for deployment lists
		},
	)
	if err != nil {
		log.Error("Error getting pod container status", "err", err, "service_id", service.ID)
		return targetDeployment, err
	}

	// Use the standard utility to calculate instance data with inferred events
	instanceData := self.calculateInstanceData(statuses, service.Edges.ServiceConfig.Replicas)

	// Attach data to deployment responses using the shared utility
	self.AttachInstanceDataToDeploymentResponses(deployments, instanceData, service.Edges.CurrentDeployment.ID)

	// Update the target deployment with the calculated data
	targetDeployment.Status = instanceData.Status
	targetDeployment.InstanceEvents = instanceData.InstanceEvents
	targetDeployment.CrashingReasons = instanceData.CrashingReasons
	targetDeployment.InstanceRestarts = instanceData.Restarts

	return targetDeployment, nil
}
