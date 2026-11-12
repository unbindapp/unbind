package group_service

import (
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

// Role groups belong to their team or project. Their grants and members change
// through the members endpoints, so every member holds exactly one role there.
func ensureNotManaged(group *ent.Group) error {
	if group.TeamID != nil {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "This group is managed by its team")
	}
	if group.ProjectID != nil {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "This group is managed by its project")
	}
	return nil
}
