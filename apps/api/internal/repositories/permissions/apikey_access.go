package permissions_repo

import (
	"context"
	"slices"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	entSchema "github.com/unbindapp/unbind-api/ent/schema"
)

// APIKeyAccess is the limit an API key puts on its owner. Every permission
// decision made with a key is the intersection of the owner's grants and this.
// The auth middleware attaches it for key callers, never for sessions.
type APIKeyAccess struct {
	Role       entSchema.PermittedAction
	FullAccess bool
	Resources  []entSchema.APIKeyResource
	Privileges []entSchema.KeyPrivilege
}

type apiKeyAccessKey struct{}

func APIKeyAccessOf(key *ent.APIKey) APIKeyAccess {
	return APIKeyAccess{Role: key.Role, FullAccess: key.FullAccess, Resources: key.Resources, Privileges: key.Privileges}
}

func WithAPIKeyAccess(ctx context.Context, access APIKeyAccess) context.Context {
	return context.WithValue(ctx, apiKeyAccessKey{}, access)
}

func APIKeyAccessFromContext(ctx context.Context) (APIKeyAccess, bool) {
	access, ok := ctx.Value(apiKeyAccessKey{}).(APIKeyAccess)
	return access, ok
}

func (a APIKeyAccess) AllowsWrites() bool {
	return a.Role == entSchema.ActionEditor || a.Role == entSchema.ActionAdmin
}

func (a APIKeyAccess) Has(privilege entSchema.KeyPrivilege) bool {
	return slices.Contains(a.Privileges, privilege)
}

// HasPrivilege is true for sessions, which hold every privilege, and for
// credentials that were given this one.
func HasPrivilege(ctx context.Context, privilege entSchema.KeyPrivilege) bool {
	access, limited := APIKeyAccessFromContext(ctx)
	if !limited {
		return true
	}
	return access.Has(privilege)
}

func (a APIKeyAccess) satisfies(action entSchema.PermittedAction) bool {
	return slices.Contains(impliedActionsFor(action), a.Role)
}

// allows is the hard-check side: the key must carry the action, and either
// reach everything or hold the resource or one of its ancestors. System
// resources are only reachable with full access.
func (a APIKeyAccess) allows(
	action entSchema.PermittedAction,
	resourceType entSchema.ResourceType,
	resourceID uuid.UUID,
	hierarchy []ResourceHierarchyInfo,
) bool {
	if !a.satisfies(action) {
		return false
	}
	if a.FullAccess {
		return true
	}
	if resourceType == entSchema.ResourceTypeSystem {
		return false
	}
	for _, resource := range a.Resources {
		if resource.ResourceType == resourceType && resourceID != uuid.Nil && resource.ResourceID == resourceID {
			return true
		}
		for _, parent := range hierarchy {
			if resource.ResourceType == parent.ResourceType && resource.ResourceID == parent.ResourceID {
				return true
			}
		}
	}
	return false
}

// accessSet is the list-filtering side. unrestricted is true for a full-access
// key whose role carries the action; a key whose role is too weak yields an
// empty set, which matches nothing.
func (a APIKeyAccess) accessSet(impliedActions []entSchema.PermittedAction) (set accessSet, unrestricted bool) {
	set = newAccessSet()
	if !slices.Contains(impliedActions, a.Role) {
		return set, false
	}
	if a.FullAccess {
		return set, true
	}
	for _, resource := range a.Resources {
		set.grant(resource.ResourceType, entSchema.ResourceSelector{ID: resource.ResourceID})
	}
	return set, false
}

// grants is the response-annotation side, feeding UserPermissionSet.
func (a APIKeyAccess) grants() grants {
	g := newGrants()
	if a.FullAccess {
		for _, resourceType := range entSchema.ResourceType("").Values() {
			g.superuser[entSchema.ResourceType(resourceType)] = a.Role
		}
		return g
	}
	for _, resource := range a.Resources {
		g.add(resource.ResourceType, a.Role, entSchema.ResourceSelector{ID: resource.ResourceID})
	}
	return g
}
