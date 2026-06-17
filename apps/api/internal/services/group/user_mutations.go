package group_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *GroupService) AddUserToGroup(ctx context.Context, requesterUserID, targetUserID, groupID uuid.UUID) error {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to manage system resources
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeSystem,
			ResourceID:   groupID,
		},
	}

	// Execute permission checks
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return err
	}

	// Check if user is already in the group
	isMember, err := self.repo.Group().HasUserWithID(ctx, groupID, targetUserID)
	if err != nil {
		return err
	}

	if isMember {
		return nil // User is already a member, nothing to do
	}

	// Add the user to the group
	return self.repo.Group().AddUser(ctx, groupID, targetUserID)
}

// RemoveUserFromGroup removes a user from a group if the requester has permission
func (self *GroupService) RemoveUserFromGroup(ctx context.Context, requesterUserID, targetUserID, groupID uuid.UUID) error {
	// Users can remove themselves from groups
	if requesterUserID == targetUserID {
		return self.repo.Group().RemoveUser(ctx, groupID, targetUserID)
	}

	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to manage system resources
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeSystem,
			ResourceID:   groupID,
		},
	}

	// Execute permission checks
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return err
	}

	// Check if user is actually in the group
	isMember, err := self.repo.Group().HasUserWithID(ctx, groupID, targetUserID)
	if err != nil {
		return err
	}

	if !isMember {
		return nil // User is not a member, nothing to do
	}

	// Remove the user from the group
	return self.repo.Group().RemoveUser(ctx, groupID, targetUserID)
}
