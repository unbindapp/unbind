package permissions_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/permission"
)

func (self *PermissionsRepository) GetByID(ctx context.Context, id uuid.UUID) (*ent.Permission, error) {
	return self.base.DB.Permission.Query().Where(permission.ID(id)).WithGroups().Only(ctx)
}
