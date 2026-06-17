package group_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// UpdateGroup updates a group if the user has permission
func (self *GroupService) UpdateGroup(ctx context.Context, userID uuid.UUID, groupID uuid.UUID, input GroupCreateInput) (*ent.Group, error) {
	// Get the existing group
	group, err := self.repo.Group().GetByID(ctx, groupID)
	if err != nil {
		// May be ent.NotFound
		return nil, err
	}

	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to manage system resources
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeSystem,
			ResourceID:   group.ID,
		},
	}

	// Execute permission checks
	if err := self.repo.Permissions().Check(ctx, userID, permissionChecks); err != nil {
		return nil, err
	}

	// Create update builder
	update := self.repo.Ent().Group.UpdateOneID(groupID)

	// Update fields if provided
	if input.Name != "" {
		update.SetName(input.Name)
	}

	if input.Description != "" {
		update.SetDescription(input.Description)
	}

	// Execute the update
	updatedGroup, err := update.Save(ctx)
	if err != nil {
		if ent.IsConstraintError(err) {
			return nil, errdefs.ErrGroupAlreadyExists
		}
		return nil, fmt.Errorf("error updating group: %w", err)
	}

	return updatedGroup, nil
}
