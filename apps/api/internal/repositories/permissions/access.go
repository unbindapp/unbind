package permissions_repo

import (
	"context"
	"fmt"
	"slices"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/environment"
	"github.com/unbindapp/unbind-api/ent/group"
	"github.com/unbindapp/unbind-api/ent/permission"
	"github.com/unbindapp/unbind-api/ent/predicate"
	"github.com/unbindapp/unbind-api/ent/project"
	entSchema "github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/ent/service"
	"github.com/unbindapp/unbind-api/ent/team"
	"github.com/unbindapp/unbind-api/ent/user"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

// * List filtering
// * Predicates narrow list queries to what the caller may see. A nil predicate
// * means every row, matchNothing means none.
// *
// * Access flows down: a grant on a team reaches its projects, environments and
// * services. For viewing, the path also flows up: a grant on a service makes
// * its environment, project and team visible as rows, so the caller can
// * navigate to what they hold. Path visibility never grants actions on the
// * ancestors themselves; that stays with Check.

// GetPotentialParents returns the resource types that can hold a grant reaching childType.
func GetPotentialParents(childType entSchema.ResourceType) []entSchema.ResourceType {
	switch childType {
	case entSchema.ResourceTypeService:
		return []entSchema.ResourceType{entSchema.ResourceTypeEnvironment, entSchema.ResourceTypeProject, entSchema.ResourceTypeTeam}
	case entSchema.ResourceTypeEnvironment:
		return []entSchema.ResourceType{entSchema.ResourceTypeProject, entSchema.ResourceTypeTeam}
	case entSchema.ResourceTypeProject:
		return []entSchema.ResourceType{entSchema.ResourceTypeTeam}
	default:
		return []entSchema.ResourceType{}
	}
}

// accessSet is what a caller reaches at one action level: every resource of a
// type, or specific ids per type. Group grants and API key limits both become
// one of these, so the same predicate builders serve both.
type accessSet struct {
	all map[entSchema.ResourceType]bool
	ids map[entSchema.ResourceType][]uuid.UUID
}

func newAccessSet() accessSet {
	return accessSet{
		all: map[entSchema.ResourceType]bool{},
		ids: map[entSchema.ResourceType][]uuid.UUID{},
	}
}

func accessFromPermissions(perms []*ent.Permission, impliedActions []entSchema.PermittedAction) accessSet {
	set := newAccessSet()
	for _, perm := range perms {
		if !slices.Contains(impliedActions, perm.Action) {
			continue
		}
		set.grant(perm.ResourceType, perm.ResourceSelector)
	}
	return set
}

func (a accessSet) grant(resourceType entSchema.ResourceType, selector entSchema.ResourceSelector) {
	switch {
	case selector.Superuser:
		a.all[resourceType] = true
	case selector.ID != uuid.Nil:
		a.ids[resourceType] = append(a.ids[resourceType], selector.ID)
	}
}

func (a accessSet) anyOf(types ...entSchema.ResourceType) bool {
	for _, t := range types {
		if a.all[t] {
			return true
		}
	}
	return false
}

func matchNothing(s *sql.Selector) {
	s.Where(sql.False())
}

func orNothing[P ~func(*sql.Selector)](or func(...P) P, preds []P) P {
	if len(preds) == 0 {
		return matchNothing
	}
	return or(preds...)
}

// intersect narrows one predicate by another. Either side being nil means that
// side imposes no restriction.
func intersect[P ~func(*sql.Selector)](a, b P, and func(...P) P) P {
	if a == nil {
		return b
	}
	if b == nil {
		return a
	}
	return and(a, b)
}

func (a accessSet) teamPredicate(withPath bool) predicate.Team {
	if a.all[entSchema.ResourceTypeTeam] {
		return nil
	}
	var preds []predicate.Team
	if ids := a.ids[entSchema.ResourceTypeTeam]; len(ids) > 0 {
		preds = append(preds, team.IDIn(ids...))
	}
	if below, ok := a.grantedProjectsOrBelow(); ok && withPath {
		preds = append(preds, hasProjects(below))
	}
	return orNothing(team.Or, preds)
}

func (a accessSet) projectPredicate(withPath bool) predicate.Project {
	if a.anyOf(entSchema.ResourceTypeProject, entSchema.ResourceTypeTeam) {
		return nil
	}
	var preds []predicate.Project
	if ids := a.ids[entSchema.ResourceTypeProject]; len(ids) > 0 {
		preds = append(preds, project.IDIn(ids...))
	}
	if ids := a.ids[entSchema.ResourceTypeTeam]; len(ids) > 0 {
		preds = append(preds, project.HasTeamWith(team.IDIn(ids...)))
	}
	if below, ok := a.grantedEnvironmentsOrBelow(); ok && withPath {
		preds = append(preds, hasEnvironments(below))
	}
	return orNothing(project.Or, preds)
}

func (a accessSet) environmentPredicate(withPath bool) predicate.Environment {
	if a.anyOf(entSchema.ResourceTypeEnvironment, entSchema.ResourceTypeProject, entSchema.ResourceTypeTeam) {
		return nil
	}
	var preds []predicate.Environment
	if ids := a.ids[entSchema.ResourceTypeEnvironment]; len(ids) > 0 {
		preds = append(preds, environment.IDIn(ids...))
	}
	if ids := a.ids[entSchema.ResourceTypeProject]; len(ids) > 0 {
		preds = append(preds, environment.HasProjectWith(project.IDIn(ids...)))
	}
	if ids := a.ids[entSchema.ResourceTypeTeam]; len(ids) > 0 {
		preds = append(preds, environment.HasProjectWith(project.HasTeamWith(team.IDIn(ids...))))
	}
	if below, ok := a.grantedServices(); ok && withPath {
		preds = append(preds, hasServices(below))
	}
	return orNothing(environment.Or, preds)
}

func (a accessSet) servicePredicate() predicate.Service {
	if a.anyOf(entSchema.ResourceTypeService, entSchema.ResourceTypeEnvironment, entSchema.ResourceTypeProject, entSchema.ResourceTypeTeam) {
		return nil
	}
	var preds []predicate.Service
	if ids := a.ids[entSchema.ResourceTypeService]; len(ids) > 0 {
		preds = append(preds, service.IDIn(ids...))
	}
	if ids := a.ids[entSchema.ResourceTypeEnvironment]; len(ids) > 0 {
		preds = append(preds, service.HasEnvironmentWith(environment.IDIn(ids...)))
	}
	if ids := a.ids[entSchema.ResourceTypeProject]; len(ids) > 0 {
		preds = append(preds, service.HasEnvironmentWith(environment.HasProjectWith(project.IDIn(ids...))))
	}
	if ids := a.ids[entSchema.ResourceTypeTeam]; len(ids) > 0 {
		preds = append(preds, service.HasEnvironmentWith(environment.HasProjectWith(project.HasTeamWith(team.IDIn(ids...)))))
	}
	return orNothing(service.Or, preds)
}

// The grantedXOrBelow helpers describe rows holding a grant at their own level
// or underneath, which is what makes their ancestors visible. ok is false when
// nothing is granted that low; a nil predicate with ok means every row.

func (a accessSet) grantedServices() (predicate.Service, bool) {
	if a.all[entSchema.ResourceTypeService] {
		return nil, true
	}
	if ids := a.ids[entSchema.ResourceTypeService]; len(ids) > 0 {
		return service.IDIn(ids...), true
	}
	return nil, false
}

func (a accessSet) grantedEnvironmentsOrBelow() (predicate.Environment, bool) {
	if a.all[entSchema.ResourceTypeEnvironment] {
		return nil, true
	}
	var preds []predicate.Environment
	if ids := a.ids[entSchema.ResourceTypeEnvironment]; len(ids) > 0 {
		preds = append(preds, environment.IDIn(ids...))
	}
	if below, ok := a.grantedServices(); ok {
		preds = append(preds, hasServices(below))
	}
	if len(preds) == 0 {
		return nil, false
	}
	return environment.Or(preds...), true
}

func (a accessSet) grantedProjectsOrBelow() (predicate.Project, bool) {
	if a.all[entSchema.ResourceTypeProject] {
		return nil, true
	}
	var preds []predicate.Project
	if ids := a.ids[entSchema.ResourceTypeProject]; len(ids) > 0 {
		preds = append(preds, project.IDIn(ids...))
	}
	if below, ok := a.grantedEnvironmentsOrBelow(); ok {
		preds = append(preds, hasEnvironments(below))
	}
	if len(preds) == 0 {
		return nil, false
	}
	return project.Or(preds...), true
}

func hasProjects(below predicate.Project) predicate.Team {
	if below == nil {
		return team.HasProjects()
	}
	return team.HasProjectsWith(below)
}

func hasEnvironments(below predicate.Environment) predicate.Project {
	if below == nil {
		return project.HasEnvironments()
	}
	return project.HasEnvironmentsWith(below)
}

func hasServices(below predicate.Service) predicate.Environment {
	if below == nil {
		return environment.HasServices()
	}
	return environment.HasServicesWith(below)
}

// resolveAccess loads what the user's groups grant for action, plus the API
// key limit when the request carries one. A nil limit means the key (or
// session) imposes nothing beyond the user's own grants.
func (self *PermissionsRepository) resolveAccess(
	ctx context.Context,
	userID uuid.UUID,
	action entSchema.PermittedAction,
) (granted accessSet, limit *accessSet, err error) {
	perms, err := self.base.DB.Permission.Query().
		Where(permission.HasGroupsWith(group.HasUsersWith(user.IDEQ(userID)))).
		All(ctx)
	if err != nil {
		return accessSet{}, nil, fmt.Errorf("error fetching user permissions: %w", err)
	}

	impliedActions := impliedActionsFor(action)
	granted = accessFromPermissions(perms, impliedActions)

	key, scoped := APIKeyAccessFromContext(ctx)
	if !scoped {
		return granted, nil, nil
	}
	keyAccess, unrestricted := key.accessSet(impliedActions)
	if unrestricted {
		return granted, nil, nil
	}
	return granted, &keyAccess, nil
}

func (self *PermissionsRepository) GetAccessibleTeamPredicates(
	ctx context.Context,
	userID uuid.UUID,
	action entSchema.PermittedAction,
) (predicate.Team, error) {
	granted, limit, err := self.resolveAccess(ctx, userID, action)
	if err != nil {
		return nil, err
	}
	withPath := action == entSchema.ActionViewer
	pred := granted.teamPredicate(withPath)
	if limit != nil {
		pred = intersect(pred, limit.teamPredicate(withPath), team.And)
	}
	return pred, nil
}

func (self *PermissionsRepository) GetAccessibleProjectPredicates(
	ctx context.Context,
	userID uuid.UUID,
	action entSchema.PermittedAction,
) (predicate.Project, error) {
	granted, limit, err := self.resolveAccess(ctx, userID, action)
	if err != nil {
		return nil, err
	}
	withPath := action == entSchema.ActionViewer
	pred := granted.projectPredicate(withPath)
	if limit != nil {
		pred = intersect(pred, limit.projectPredicate(withPath), project.And)
	}
	return pred, nil
}

// GetAccessibleEnvironmentPredicates optionally narrows to one project.
func (self *PermissionsRepository) GetAccessibleEnvironmentPredicates(
	ctx context.Context,
	userID uuid.UUID,
	action entSchema.PermittedAction,
	projectID *uuid.UUID,
) (predicate.Environment, error) {
	granted, limit, err := self.resolveAccess(ctx, userID, action)
	if err != nil {
		return nil, err
	}
	withPath := action == entSchema.ActionViewer
	pred := granted.environmentPredicate(withPath)
	if limit != nil {
		pred = intersect(pred, limit.environmentPredicate(withPath), environment.And)
	}
	if projectID != nil {
		pred = intersect(pred, environment.HasProjectWith(project.IDEQ(*projectID)), environment.And)
	}
	return pred, nil
}

// GetAccessibleServicePredicates optionally narrows to one environment.
func (self *PermissionsRepository) GetAccessibleServicePredicates(
	ctx context.Context,
	userID uuid.UUID,
	action entSchema.PermittedAction,
	environmentID *uuid.UUID,
) (predicate.Service, error) {
	granted, limit, err := self.resolveAccess(ctx, userID, action)
	if err != nil {
		return nil, err
	}
	pred := granted.servicePredicate()
	if limit != nil {
		pred = intersect(pred, limit.servicePredicate(), service.And)
	}
	if environmentID != nil {
		pred = intersect(pred, service.HasEnvironmentWith(environment.IDEQ(*environmentID)), service.And)
	}
	return pred, nil
}

// CheckVisible passes when the caller may see the row at all: they can act on
// it, or it sits on the path to something they can. Use it to fetch a single
// team, project or environment. Never use it to act on one; that is Check.
func (self *PermissionsRepository) CheckVisible(
	ctx context.Context,
	userID uuid.UUID,
	resourceType entSchema.ResourceType,
	resourceID uuid.UUID,
) error {
	if IsSystemCaller(ctx) {
		return nil
	}

	var visible bool
	var err error
	switch resourceType {
	case entSchema.ResourceTypeTeam:
		pred, predErr := self.GetAccessibleTeamPredicates(ctx, userID, entSchema.ActionViewer)
		if predErr != nil {
			return predErr
		}
		visible, err = self.base.DB.Team.Query().Where(team.ID(resourceID)).Where(orAll(pred)).Exist(ctx)
	case entSchema.ResourceTypeProject:
		pred, predErr := self.GetAccessibleProjectPredicates(ctx, userID, entSchema.ActionViewer)
		if predErr != nil {
			return predErr
		}
		visible, err = self.base.DB.Project.Query().Where(project.ID(resourceID)).Where(orAll(pred)).Exist(ctx)
	case entSchema.ResourceTypeEnvironment:
		pred, predErr := self.GetAccessibleEnvironmentPredicates(ctx, userID, entSchema.ActionViewer, nil)
		if predErr != nil {
			return predErr
		}
		visible, err = self.base.DB.Environment.Query().Where(environment.ID(resourceID)).Where(orAll(pred)).Exist(ctx)
	case entSchema.ResourceTypeService:
		pred, predErr := self.GetAccessibleServicePredicates(ctx, userID, entSchema.ActionViewer, nil)
		if predErr != nil {
			return predErr
		}
		visible, err = self.base.DB.Service.Query().Where(service.ID(resourceID)).Where(orAll(pred)).Exist(ctx)
	default:
		return errdefs.ErrUnauthorized
	}
	if err != nil {
		return fmt.Errorf("error checking visibility: %w", err)
	}
	if !visible {
		return errdefs.ErrUnauthorized
	}
	return nil
}

func orAll[P ~func(*sql.Selector)](pred P) P {
	if pred == nil {
		return func(s *sql.Selector) {}
	}
	return pred
}
