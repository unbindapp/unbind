package group_service

import (
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

// Role groups belong to their team. Their grants and members change through the
// team members endpoints, so every member holds exactly one role on the team.
func ensureNotManaged(group *ent.Group) error {
	if group.TeamID == nil {
		return nil
	}
	return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "This group is managed by its team")
}
