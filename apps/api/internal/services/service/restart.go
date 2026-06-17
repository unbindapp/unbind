package service_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// Restart a service by ID
func (self *ServiceService) RestartServiceByID(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, teamID, projectID, environmentID, serviceID uuid.UUID) error {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to admin service
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeService,
			ResourceID:   serviceID,
		},
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return err
	}

	env, project, err := self.VerifyInputs(ctx, teamID, projectID, environmentID)
	if err != nil {
		return err
	}

	// Get service
	service, err := self.repo.Service().GetByID(ctx, serviceID)
	if err != nil {
		if ent.IsNotFound(err) {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found")
		}
		return err
	}

	if env.ID != service.EnvironmentID {
		return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found")
	}

	// Restart pod
	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return err
	}

	return self.k8s.RollingRestartPodsByLabel(ctx, project.Edges.Team.Namespace, "unbind-service", service.ID.String(), client)
}
