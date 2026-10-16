package group_service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *GroupService) AddUserToGroup(ctx context.Context, requesterUserID, targetUserID, groupID uuid.UUID) error {
	if err := self.ensureGroupNotManaged(ctx, groupID); err != nil {
		return err
	}
	if err := self.ensureCanChangeMembers(ctx, requesterUserID, groupID); err != nil {
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

	return self.repo.Group().AddUser(ctx, groupID, targetUserID)
}

// RemoveUserFromGroup removes a user from a group if the requester has permission
func (self *GroupService) RemoveUserFromGroup(ctx context.Context, requesterUserID, targetUserID, groupID uuid.UUID) error {
	if err := self.ensureGroupNotManaged(ctx, groupID); err != nil {
		return err
	}

	// Users can remove themselves from groups
	if requesterUserID == targetUserID {
		return self.repo.Group().RemoveUser(ctx, groupID, targetUserID)
	}
	if err := self.ensureCanChangeMembers(ctx, requesterUserID, groupID); err != nil {
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

	return self.repo.Group().RemoveUser(ctx, groupID, targetUserID)
}

// ensureCanChangeMembers treats a membership change as granting the group's
// permissions: a system editor may only hand out what they hold themselves,
// so joining a more powerful group is not a way up. Instance admins are exempt.
func (self *GroupService) ensureCanChangeMembers(ctx context.Context, requesterUserID, groupID uuid.UUID) error {
	if err := self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{
		{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeSystem, ResourceID: groupID},
	}); err != nil {
		return err
	}
	if err := self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{
		{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeSystem, ResourceID: groupID},
	}); err == nil {
		return nil
	}

	grants, err := self.repo.Group().GetPermissions(ctx, groupID)
	if err != nil {
		return err
	}
	for _, grant := range grants {
		// A nil ID with a superuser selector passes only for a superuser grant on the type
		err := self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{
			{Action: grant.Action, ResourceType: grant.ResourceType, ResourceID: grant.ResourceSelector.ID},
		})
		if errors.Is(err, errdefs.ErrUnauthorized) {
			return fmt.Errorf("%w: the group grants more than you hold", errdefs.ErrUnauthorized)
		}
		if err != nil {
			return err
		}
	}
	return nil
}

func (self *GroupService) ensureGroupNotManaged(ctx context.Context, groupID uuid.UUID) error {
	group, err := self.repo.Group().GetByID(ctx, groupID)
	if err != nil {
		return err
	}
	return ensureNotManaged(group)
}
