package permissions_repo

import (
	"context"
	"slices"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/environment"
	"github.com/unbindapp/unbind-api/ent/predicate"
	"github.com/unbindapp/unbind-api/ent/project"
	entSchema "github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/ent/service"
	"github.com/unbindapp/unbind-api/ent/team"
)

type apiKeyScopesKey struct{}

// WithAPIKeyScopes narrows every permission decision made with ctx to the
// intersection of the user's own grants and these scopes. Set by the auth
// middleware for API key callers, never for sessions.
func WithAPIKeyScopes(ctx context.Context, scopes []entSchema.APIKeyScope) context.Context {
	return context.WithValue(ctx, apiKeyScopesKey{}, scopes)
}

func APIKeyScopesFromContext(ctx context.Context) ([]entSchema.APIKeyScope, bool) {
	scopes, ok := ctx.Value(apiKeyScopesKey{}).([]entSchema.APIKeyScope)
	return scopes, ok
}

// ScopesAllowWrites reports whether any scope grants more than viewing.
func ScopesAllowWrites(scopes []entSchema.APIKeyScope) bool {
	for _, scope := range scopes {
		if scope.Action == entSchema.ActionEditor || scope.Action == entSchema.ActionAdmin {
			return true
		}
	}
	return false
}

func scopesAllow(
	scopes []entSchema.APIKeyScope,
	action entSchema.PermittedAction,
	resourceType entSchema.ResourceType,
	resourceID uuid.UUID,
	hierarchy []ResourceHierarchyInfo,
) bool {
	impliedActions := impliedActionsFor(action)
	for _, scope := range scopes {
		if !slices.Contains(impliedActions, scope.Action) {
			continue
		}
		if scope.ResourceType == resourceType && scope.ResourceSelector.Superuser {
			return true
		}
		if scope.ResourceType == resourceType && resourceID != uuid.Nil && scope.ResourceSelector.ID == resourceID {
			return true
		}
		for _, parent := range hierarchy {
			if scope.ResourceType != parent.ResourceType {
				continue
			}
			if scope.ResourceSelector.Superuser || scope.ResourceSelector.ID == parent.ResourceID {
				return true
			}
		}
	}
	return false
}

type scopeIndex struct {
	superuser map[entSchema.ResourceType]bool
	ids       map[entSchema.ResourceType][]uuid.UUID
}

func indexScopes(scopes []entSchema.APIKeyScope, impliedActions []entSchema.PermittedAction) scopeIndex {
	idx := scopeIndex{
		superuser: map[entSchema.ResourceType]bool{},
		ids:       map[entSchema.ResourceType][]uuid.UUID{},
	}
	for _, scope := range scopes {
		if !slices.Contains(impliedActions, scope.Action) {
			continue
		}
		switch {
		case scope.ResourceSelector.Superuser:
			idx.superuser[scope.ResourceType] = true
		case scope.ResourceSelector.ID != uuid.Nil:
			idx.ids[scope.ResourceType] = append(idx.ids[scope.ResourceType], scope.ResourceSelector.ID)
		}
	}
	return idx
}

func (idx scopeIndex) anySuperuser(types ...entSchema.ResourceType) bool {
	for _, t := range types {
		if idx.superuser[t] {
			return true
		}
	}
	return false
}

// The scope predicate builders mirror the group predicate builders: nil means
// unrestricted, a false predicate means nothing is visible.
func scopeTeamPredicate(idx scopeIndex) predicate.Team {
	if idx.anySuperuser(entSchema.ResourceTypeTeam) {
		return nil
	}
	if ids := idx.ids[entSchema.ResourceTypeTeam]; len(ids) > 0 {
		return team.IDIn(ids...)
	}
	return matchNothing
}

func scopeProjectPredicate(idx scopeIndex) predicate.Project {
	if idx.anySuperuser(entSchema.ResourceTypeProject, entSchema.ResourceTypeTeam) {
		return nil
	}
	var preds []predicate.Project
	if ids := idx.ids[entSchema.ResourceTypeProject]; len(ids) > 0 {
		preds = append(preds, project.IDIn(ids...))
	}
	if ids := idx.ids[entSchema.ResourceTypeTeam]; len(ids) > 0 {
		preds = append(preds, project.HasTeamWith(team.IDIn(ids...)))
	}
	if len(preds) == 0 {
		return matchNothing
	}
	return project.Or(preds...)
}

func scopeEnvironmentPredicate(idx scopeIndex) predicate.Environment {
	if idx.anySuperuser(entSchema.ResourceTypeEnvironment, entSchema.ResourceTypeProject, entSchema.ResourceTypeTeam) {
		return nil
	}
	var preds []predicate.Environment
	if ids := idx.ids[entSchema.ResourceTypeEnvironment]; len(ids) > 0 {
		preds = append(preds, environment.IDIn(ids...))
	}
	if ids := idx.ids[entSchema.ResourceTypeProject]; len(ids) > 0 {
		preds = append(preds, environment.HasProjectWith(project.IDIn(ids...)))
	}
	if ids := idx.ids[entSchema.ResourceTypeTeam]; len(ids) > 0 {
		preds = append(preds, environment.HasProjectWith(project.HasTeamWith(team.IDIn(ids...))))
	}
	if len(preds) == 0 {
		return matchNothing
	}
	return environment.Or(preds...)
}

func scopeServicePredicate(idx scopeIndex) predicate.Service {
	if idx.anySuperuser(entSchema.ResourceTypeService, entSchema.ResourceTypeEnvironment, entSchema.ResourceTypeProject, entSchema.ResourceTypeTeam) {
		return nil
	}
	var preds []predicate.Service
	if ids := idx.ids[entSchema.ResourceTypeService]; len(ids) > 0 {
		preds = append(preds, service.IDIn(ids...))
	}
	if ids := idx.ids[entSchema.ResourceTypeEnvironment]; len(ids) > 0 {
		preds = append(preds, service.HasEnvironmentWith(environment.IDIn(ids...)))
	}
	if ids := idx.ids[entSchema.ResourceTypeProject]; len(ids) > 0 {
		preds = append(preds, service.HasEnvironmentWith(environment.HasProjectWith(project.IDIn(ids...))))
	}
	if ids := idx.ids[entSchema.ResourceTypeTeam]; len(ids) > 0 {
		preds = append(preds, service.HasEnvironmentWith(environment.HasProjectWith(project.HasTeamWith(team.IDIn(ids...)))))
	}
	if len(preds) == 0 {
		return matchNothing
	}
	return service.Or(preds...)
}

func matchNothing(s *sql.Selector) {
	s.Where(sql.False())
}

// intersectPredicates narrows the user's predicate by the key's scope predicate.
// Either side being nil means that side imposes no restriction.
func intersectPredicates[P ~func(*sql.Selector)](user, scope P, and func(...P) P) P {
	if user == nil {
		return scope
	}
	if scope == nil {
		return user
	}
	return and(user, scope)
}

func (self *PermissionsRepository) scopedTeamPredicate(ctx context.Context, user predicate.Team, impliedActions []entSchema.PermittedAction) predicate.Team {
	scopes, scoped := APIKeyScopesFromContext(ctx)
	if !scoped {
		return user
	}
	return intersectPredicates(user, scopeTeamPredicate(indexScopes(scopes, impliedActions)), team.And)
}

func (self *PermissionsRepository) scopedProjectPredicate(ctx context.Context, user predicate.Project, impliedActions []entSchema.PermittedAction) predicate.Project {
	scopes, scoped := APIKeyScopesFromContext(ctx)
	if !scoped {
		return user
	}
	return intersectPredicates(user, scopeProjectPredicate(indexScopes(scopes, impliedActions)), project.And)
}

func (self *PermissionsRepository) scopedEnvironmentPredicate(ctx context.Context, user predicate.Environment, impliedActions []entSchema.PermittedAction) predicate.Environment {
	scopes, scoped := APIKeyScopesFromContext(ctx)
	if !scoped {
		return user
	}
	return intersectPredicates(user, scopeEnvironmentPredicate(indexScopes(scopes, impliedActions)), environment.And)
}

func (self *PermissionsRepository) scopedServicePredicate(ctx context.Context, user predicate.Service, impliedActions []entSchema.PermittedAction) predicate.Service {
	scopes, scoped := APIKeyScopesFromContext(ctx)
	if !scoped {
		return user
	}
	return intersectPredicates(user, scopeServicePredicate(indexScopes(scopes, impliedActions)), service.And)
}
