package system_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *SystemService) DeleteRegistry(ctx context.Context, requesterUserID uuid.UUID, input models.DeleteRegistryInput) error {
	permissionChecks := []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeSystem,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return err
	}

	registry, err := self.repo.System().GetRegistry(ctx, input.ID)
	if err != nil {
		if ent.IsNotFound(err) {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Registry not found")
		}
		return err
	}

	if registry.IsDefault {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Default registry cannot be deleted")
	}

	// Delete registry
	if err := self.repo.System().DeleteRegistry(ctx, input.ID); err != nil {
		return err
	}

	return nil
}
