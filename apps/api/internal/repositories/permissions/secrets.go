package permissions_repo

import (
	"context"
	"errors"

	"github.com/google/uuid"
	entSchema "github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

// CanReadSecrets decides whether the caller may see stored secrets on a
// resource, such as variable values or webhook URLs. A session needs the editor
// role there, because a stored secret is as good as write access to whatever it
// unlocks. A key or connected app needs the privilege, whatever its role, as
// long as its owner holds editor.
func CanReadSecrets(ctx context.Context, perms PermissionsRepositoryInterface, userID uuid.UUID, privilege entSchema.KeyPrivilege, resourceType entSchema.ResourceType, resourceID uuid.UUID) (bool, error) {
	access, limited := APIKeyAccessFromContext(ctx)
	if limited {
		if !access.Has(privilege) {
			return false, nil
		}
		access.Role = entSchema.ActionEditor
		ctx = WithAPIKeyAccess(ctx, access)
	}
	err := perms.Check(ctx, userID, []PermissionCheck{{Action: entSchema.ActionEditor, ResourceType: resourceType, ResourceID: resourceID}})
	if errors.Is(err, errdefs.ErrUnauthorized) {
		return false, nil
	}
	return err == nil, err
}
