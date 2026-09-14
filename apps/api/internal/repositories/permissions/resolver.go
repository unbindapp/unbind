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
// groups grant, loaded once per request to annotate response DTOs. For API key
// callers it is further limited to the key's scopes.
type UserPermissionSet struct {
	granted grants
	limit   *grants
}

type grants struct {
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

	set := &UserPermissionSet{granted: newGrants()}
	for _, perm := range perms {
		set.granted.add(perm.ResourceType, perm.Action, perm.ResourceSelector)
	}

	scopes, scoped := APIKeyScopesFromContext(ctx)
	if !scoped {
		return set, nil
	}

	limit := newGrants()
	for _, scope := range scopes {
		limit.add(scope.ResourceType, scope.Action, scope.ResourceSelector)
	}
	set.limit = &limit
	return set, nil
}

func newGrants() grants {
	return grants{
		superuser: make(map[entSchema.ResourceType]entSchema.PermittedAction),
		byID:      make(map[entSchema.ResourceType]map[uuid.UUID]entSchema.PermittedAction),
	}
}

func (g *grants) add(resourceType entSchema.ResourceType, action entSchema.PermittedAction, selector entSchema.ResourceSelector) {
	switch {
	case selector.Superuser:
		g.superuser[resourceType] = strongerAction(g.superuser[resourceType], action)
	case selector.ID != uuid.Nil:
		byID := g.byID[resourceType]
		if byID == nil {
			byID = make(map[uuid.UUID]entSchema.PermittedAction)
			g.byID[resourceType] = byID
		}
		byID[selector.ID] = strongerAction(byID[selector.ID], action)
	}
}

func (g *grants) strongest(refs ...ResourceRef) entSchema.PermittedAction {
	var best entSchema.PermittedAction
	for _, ref := range refs {
		best = strongerAction(best, g.superuser[ref.Type])
		if byID := g.byID[ref.Type]; byID != nil {
			best = strongerAction(best, byID[ref.ID])
		}
	}
	return best
}

// AllowedActions returns the actions permitted on the first ref, considering
// grants on the ref itself and any ancestor refs, expanded via action implication.
func (s *UserPermissionSet) AllowedActions(refs ...ResourceRef) []entSchema.PermittedAction {
	best := s.granted.strongest(refs...)
	if s.limit != nil {
		best = weakerAction(best, s.limit.strongest(refs...))
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

func (s *UserPermissionSet) SystemActions() []entSchema.PermittedAction {
	return s.AllowedActions(ResourceRef{Type: entSchema.ResourceTypeSystem})
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

func weakerAction(a, b entSchema.PermittedAction) entSchema.PermittedAction {
	if actionRank(b) < actionRank(a) {
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
