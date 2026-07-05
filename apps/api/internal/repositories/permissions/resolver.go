package permissions_repo

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/group"
	"github.com/unbindapp/unbind-api/ent/permission"
	entSchema "github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/ent/user"
)

// UserPermissionSet is an in-memory snapshot of every permission the user's
// groups grant, loaded once per request to annotate response DTOs.
type UserPermissionSet struct {
	superuser map[entSchema.ResourceType]entSchema.PermittedAction
	byID      map[entSchema.ResourceType]map[uuid.UUID]entSchema.PermittedAction
}

// ResourceRef identifies a resource or one of its ancestors for permission evaluation.
type ResourceRef struct {
	Type entSchema.ResourceType
	ID   uuid.UUID
}

// GetUserPermissionSet loads all permissions granted through the user's groups in a single query.
func (self *PermissionsRepository) GetUserPermissionSet(ctx context.Context, userID uuid.UUID) (*UserPermissionSet, error) {
	perms, err := self.base.DB.Permission.Query().
		Where(permission.HasGroupsWith(group.HasUsersWith(user.IDEQ(userID)))).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("error fetching user permissions: %w", err)
	}

	set := &UserPermissionSet{
		superuser: make(map[entSchema.ResourceType]entSchema.PermittedAction),
		byID:      make(map[entSchema.ResourceType]map[uuid.UUID]entSchema.PermittedAction),
	}

	for _, perm := range perms {
		switch {
		case perm.ResourceSelector.Superuser:
			set.superuser[perm.ResourceType] = strongerAction(set.superuser[perm.ResourceType], perm.Action)
		case perm.ResourceSelector.ID != uuid.Nil:
			byID := set.byID[perm.ResourceType]
			if byID == nil {
				byID = make(map[uuid.UUID]entSchema.PermittedAction)
				set.byID[perm.ResourceType] = byID
			}
			byID[perm.ResourceSelector.ID] = strongerAction(byID[perm.ResourceSelector.ID], perm.Action)
		}
	}

	return set, nil
}

// AllowedActions returns the actions permitted on the first ref, considering
// grants on the ref itself and any ancestor refs, expanded via action implication.
func (s *UserPermissionSet) AllowedActions(refs ...ResourceRef) []entSchema.PermittedAction {
	var best entSchema.PermittedAction
	for _, ref := range refs {
		best = strongerAction(best, s.superuser[ref.Type])
		if byID := s.byID[ref.Type]; byID != nil {
			best = strongerAction(best, byID[ref.ID])
		}
	}

	switch best {
	case entSchema.ActionAdmin:
		return []entSchema.PermittedAction{entSchema.ActionAdmin, entSchema.ActionEditor, entSchema.ActionViewer}
	case entSchema.ActionEditor:
		return []entSchema.PermittedAction{entSchema.ActionEditor, entSchema.ActionViewer}
	case entSchema.ActionViewer:
		return []entSchema.PermittedAction{entSchema.ActionViewer}
	default:
		return []entSchema.PermittedAction{}
	}
}

func (s *UserPermissionSet) TeamActions(teamID uuid.UUID) []entSchema.PermittedAction {
	return s.AllowedActions(
		ResourceRef{Type: entSchema.ResourceTypeTeam, ID: teamID},
	)
}

func (s *UserPermissionSet) ProjectActions(teamID, projectID uuid.UUID) []entSchema.PermittedAction {
	return s.AllowedActions(
		ResourceRef{Type: entSchema.ResourceTypeProject, ID: projectID},
		ResourceRef{Type: entSchema.ResourceTypeTeam, ID: teamID},
	)
}

func (s *UserPermissionSet) EnvironmentActions(teamID, projectID, environmentID uuid.UUID) []entSchema.PermittedAction {
	return s.AllowedActions(
		ResourceRef{Type: entSchema.ResourceTypeEnvironment, ID: environmentID},
		ResourceRef{Type: entSchema.ResourceTypeProject, ID: projectID},
		ResourceRef{Type: entSchema.ResourceTypeTeam, ID: teamID},
	)
}

func (s *UserPermissionSet) ServiceActions(teamID, projectID, environmentID, serviceID uuid.UUID) []entSchema.PermittedAction {
	return s.AllowedActions(
		ResourceRef{Type: entSchema.ResourceTypeService, ID: serviceID},
		ResourceRef{Type: entSchema.ResourceTypeEnvironment, ID: environmentID},
		ResourceRef{Type: entSchema.ResourceTypeProject, ID: projectID},
		ResourceRef{Type: entSchema.ResourceTypeTeam, ID: teamID},
	)
}

func strongerAction(a, b entSchema.PermittedAction) entSchema.PermittedAction {
	if actionRank(b) > actionRank(a) {
		return b
	}
	return a
}

func actionRank(action entSchema.PermittedAction) int {
	switch action {
	case entSchema.ActionAdmin:
		return 3
	case entSchema.ActionEditor:
		return 2
	case entSchema.ActionViewer:
		return 1
	default:
		return 0
	}
}
