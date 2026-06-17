package group_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/group"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// DeleteGroup deletes a group if the user has permissions
func (self *GroupService) DeleteGroup(ctx context.Context, userID uuid.UUID, groupID uuid.UUID) error {
	// Get the group to determine its type
	groupToDelete, err := self.repo.Group().GetByID(ctx, groupID)
	if err != nil {
		// May be ent.NotFound
		return err
	}

	// Determine permissions based on group type (global vs team)
	if err := self.repo.Permissions().Check(
		ctx,
		userID,
		[]permissions_repo.PermissionCheck{
			{
				Action:       schema.ActionAdmin,
				ResourceType: schema.ResourceTypeSystem,
			},
		},
	); err != nil {
		return err
	}

	// If the group has K8s RBAC, clean it up first
	if groupToDelete.K8sRoleName != nil {
		if err := self.rbacManager.DeleteK8sRBAC(ctx, groupToDelete); err != nil {
			log.Warnf("Error cleaning up K8s RBAC: %v", err)
		}
	}

	// Delete the group and all its associations
	_, err = self.repo.Ent().Group.Delete().Where(group.ID(groupID)).Exec(ctx)
	return err
}
