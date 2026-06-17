package group_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// Skips permission checks
var SUPER_USER_ID = uuid.MustParse("60303901-c88f-47f0-b888-ecf92988d9fc")

// Handles permissions, grants, kubernetes RBAC, etc.

// GrantPermissionToGroup grants a permission to a group
func (self *GroupService) GrantPermissionToGroup(
	ctx context.Context,
	requesterUserID,
	groupID uuid.UUID,
	permAction schema.PermittedAction,
	resourceType schema.ResourceType,
	selector schema.ResourceSelector,
) (*ent.Permission, error) {
	// Get the group
	group, err := self.repo.Group().GetByID(ctx, groupID)
	if err != nil {
		// May be ent.NotFound
		return nil, err
	}

	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to manage system resources
		{
			Action:       schema.ActionAdmin,
			ResourceType: schema.ResourceTypeSystem,
			ResourceID:   group.ID,
		},
	}

	// Execute permission checks
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		if requesterUserID != SUPER_USER_ID {
			return nil, err
		}
	}

	// Create the permission
	perm, err := self.repo.Permissions().Create(ctx, permAction, resourceType, selector)
	if err != nil {
		return nil, fmt.Errorf("error creating permission: %w", err)
	}

	// Associate the permission with the group
	if err := self.repo.Permissions().AddToGroup(ctx, groupID, perm.ID); err != nil {
		// If we fail to associate, clean up the permission
		_ = self.repo.Permissions().Delete(ctx, perm.ID)
		return nil, fmt.Errorf("error associating permission with group: %w", err)
	}

	// Check if this permission affects Kubernetes resources
	needsK8sSync := resourceType == schema.ResourceTypeTeam

	if needsK8sSync {
		// Sync the group's RBAC
		if err := self.rbacManager.SyncGroupToK8s(ctx, group); err != nil {
			// Log but continue
			log.Warnf("Warning: error syncing K8s RBAC: %v", err)
		}
	}

	return perm, nil
}

// RevokePermissionFromGroup revokes a permission from a group
func (self *GroupService) RevokePermissionFromGroup(
	ctx context.Context,
	requesterUserID uuid.UUID,
	groupID uuid.UUID,
	permissionID uuid.UUID,
) error {
	// Get the group
	group, err := self.repo.Group().GetByID(ctx, groupID)
	if err != nil {
		return err
	}

	// Get the permission
	perm, err := self.repo.Permissions().GetByID(ctx, permissionID)
	if err != nil {
		return err
	}

	// Verify the permission is associated with the group
	var isAssociated bool
	for _, g := range perm.Edges.Groups {
		if g.ID == groupID {
			isAssociated = true
			break
		}
	}

	if !isAssociated {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "permission is not associated with group")
	}

	// Check if requester has permission to revoke
	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to manage system resources
		{
			Action:       schema.ActionAdmin,
			ResourceType: schema.ResourceTypeSystem,
			ResourceID:   group.ID,
		},
	}

	// Execute permission checks
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return err
	}

	// Remove the permission from the group
	if err := self.repo.Permissions().RemoveFromGroup(ctx, groupID, permissionID); err != nil {
		return fmt.Errorf("error removing permission from group: %w", err)
	}

	// Delete the permission if it's not used by any other groups
	if len(perm.Edges.Groups) <= 1 {
		if err := self.repo.Permissions().Delete(ctx, permissionID); err != nil {
			return fmt.Errorf("error deleting orphaned permission: %w", err)
		}
	}

	// Check if permission affects Kubernetes resources
	needsK8sSync := perm.ResourceType == schema.ResourceTypeTeam

	if needsK8sSync {
		// Get updated permissions
		perms, err := self.repo.Group().GetPermissions(ctx, groupID)
		if err != nil {
			return err
		}

		// Check if there are any remaining permissions that would affect k8s
		hasK8sPerms := false
		for _, p := range perms {
			if p.ResourceType == schema.ResourceTypeTeam {
				hasK8sPerms = true
				break
			}
		}

		if hasK8sPerms {
			// Sync the group's RBAC
			if err := self.rbacManager.SyncGroupToK8s(ctx, group); err != nil {
				// Log but continue
				fmt.Printf("Warning: error syncing K8s RBAC: %v", err)
			}
		} else {
			// No k8s-related permissions left, remove RBAC
			if err := self.rbacManager.DeleteK8sRBAC(ctx, group); err != nil {
				// Log but continue
				fmt.Printf("Warning: error removing K8s RBAC: %v", err)
			}
		}
	}

	return nil
}

// GetGroupPermissions lists all permissions for a group
func (self *GroupService) GetGroupPermissions(
	ctx context.Context,
	requesterUserID uuid.UUID,
	groupID uuid.UUID,
) ([]*ent.Permission, error) {
	// Get the group
	group, err := self.repo.Group().GetByID(ctx, groupID)
	if err != nil {
		return nil, err
	}

	isMember, err := self.repo.Group().HasUserWithID(ctx, groupID, requesterUserID)
	if err != nil {
		return nil, err
	}

	// Members always have access so view group permissions
	if !isMember {
		permissionChecks := []permissions_repo.PermissionCheck{
			// Has permission to read system resources
			{
				Action:       schema.ActionViewer,
				ResourceType: schema.ResourceTypeSystem,
				ResourceID:   group.ID,
			},
		}

		// Execute permission checks
		if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
			return nil, err
		}
	}

	// Get the group permissions
	return self.repo.Group().GetPermissions(ctx, groupID)
}

// GetUserGroups gets all groups a user belongs to
func (self *GroupService) GetUserGroups(
	ctx context.Context,
	requesterUserID uuid.UUID,
	targetUserID uuid.UUID,
) ([]*ent.Group, error) {
	// Check if requester has permission to view user's groups
	if requesterUserID != targetUserID {
		permissionChecks := []permissions_repo.PermissionCheck{
			// Has permission to read system resources
			{
				Action:       schema.ActionViewer,
				ResourceType: schema.ResourceTypeSystem,
				ResourceID:   targetUserID,
			},
		}

		// Execute permission checks
		if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
			return nil, err
		}
	}

	// Get all groups the user belongs to
	return self.repo.User().GetGroups(ctx, targetUserID)
}
