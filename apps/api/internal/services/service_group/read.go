package servicegroup_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// Get one
func (self *ServiceGroupService) GetServiceGroupByID(ctx context.Context, requesterUserID uuid.UUID, input *models.GetServiceGroupInput) (*models.ServiceGroupResponse, error) {
	// Check permissions
	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to manage teams
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeEnvironment,
			ResourceID:   input.EnvironmentID,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Verify inputs
	environment, _, err := self.VerifyInputs(ctx, input.TeamID, input.ProjectID, input.EnvironmentID)
	if err != nil {
		return nil, err
	}

	grp, err := self.repo.ServiceGroup().GetByID(ctx, input.ID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service group not found")
		}
		return nil, err
	}

	if grp.EnvironmentID != environment.ID {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service group not found")
	}

	return models.TransformServiceGroupEntity(grp), nil
}

// Get many
func (self *ServiceGroupService) GetServiceGroupByEnvironment(ctx context.Context, requesterUserID uuid.UUID, input *models.ListServiceGroupsInput) ([]*models.ServiceGroupResponse, error) {
	// Check permissions
	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to manage teams
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeEnvironment,
			ResourceID:   input.EnvironmentID,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Verify inputs
	_, _, err := self.VerifyInputs(ctx, input.TeamID, input.ProjectID, input.EnvironmentID)
	if err != nil {
		return nil, err
	}

	grps, err := self.repo.ServiceGroup().GetByEnvironmentID(ctx, input.EnvironmentID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service group not found")
		}
		return nil, err
	}

	return models.TransformServiceGroupEntities(grps), nil
}
