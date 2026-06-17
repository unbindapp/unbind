package servicegroup_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// Changing name basically
func (self *ServiceGroupService) UpdateServiceGroup(ctx context.Context, requesterUserID uuid.UUID, input *models.UpdateServiceGroupInput) (*models.ServiceGroupResponse, error) {
	// Check permissions
	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to manage teams
		{
			Action:       schema.ActionEditor,
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

	if environment.ID != input.EnvironmentID {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Environment not found")
	}

	existingGroup, err := self.repo.ServiceGroup().GetByID(ctx, input.ID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service group not found")
		}
		return nil, err
	}

	// Make sure input.AddServiceIDs and RemoveServiceIDs don't collide
	// Create a map to track IDs in AddServiceIDs for O(1) lookups
	addIDsMap := make(map[uuid.UUID]struct{})
	for _, id := range input.AddServiceIDs {
		addIDsMap[id] = struct{}{}
	}

	// Check if any ID in RemoveServiceIDs exists in AddServiceIDs
	for _, id := range input.RemoveServiceIDs {
		if _, exists := addIDsMap[id]; exists {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("Service ID %s is in both AddServiceIDs and RemoveServiceIDs", id))
		}
	}

	// Make sure input.AddServiceIDs and RemoveServiceIDs are valid for this environment
	var servicesToAdd []*ent.Service
	if len(input.AddServiceIDs) > 0 {
		servicesToAdd, err = self.repo.Service().GetByIDsAndEnvironment(ctx, input.AddServiceIDs, input.EnvironmentID)
		if err != nil {
			return nil, err
		}
		if len(servicesToAdd) != len(input.AddServiceIDs) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Some services to add do not exist")
		}

		for _, service := range servicesToAdd {
			if service.ServiceGroupID != nil && *service.ServiceGroupID != existingGroup.ID {
				return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("Service %s is already in another service group", service.ID))
			}
		}
	}

	if len(input.RemoveServiceIDs) > 0 {
		servicesToRemove, err := self.repo.Service().GetByIDsAndEnvironment(ctx, input.RemoveServiceIDs, input.EnvironmentID)
		if err != nil {
			return nil, err
		}
		if len(servicesToRemove) != len(input.RemoveServiceIDs) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Some services to remove do not exist")
		}
	}

	// Execute update
	grp, err := self.repo.ServiceGroup().Update(ctx, input)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service group not found")
		}
		return nil, err
	}

	return models.TransformServiceGroupEntity(grp), nil
}
