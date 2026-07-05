package user_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *UserService) DeleteUser(ctx context.Context, requesterUserID, userID uuid.UUID) error {
	if requesterUserID == userID {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Cannot delete your own user")
	}

	permissionChecks := []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionAdmin,
			ResourceType: schema.ResourceTypeSystem,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return err
	}

	if _, err := self.repo.User().GetByID(ctx, userID); err != nil {
		if ent.IsNotFound(err) {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "User not found")
		}
		return err
	}

	return self.repo.User().Delete(ctx, userID)
}
