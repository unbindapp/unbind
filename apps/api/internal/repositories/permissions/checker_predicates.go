package permissions_repo

import (
	"context"
	"fmt"

	"entgo.io/ent/dialect/sql"
	"entgo.io/ent/dialect/sql/sqljson"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/environment"
	"github.com/unbindapp/unbind-api/ent/group"
	"github.com/unbindapp/unbind-api/ent/permission"
	"github.com/unbindapp/unbind-api/ent/predicate"
	"github.com/unbindapp/unbind-api/ent/project"
	entSchema "github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/ent/service"
	"github.com/unbindapp/unbind-api/ent/team"
)

// * Predicate-Based Permission Logic
// * Intended to return ent predicates that can be used to filter resources
// * E.G. - I can read project A - when I query teams I only get project A, not project B

// GetPotentialParents returns a list of resource types that can be parents of the given childType.
// This should ideally be derived directly from schema definitions or a central schema utility.
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

// GetAccessibleProjectPredicates returns Ent predicates for filtering projects
// that the user has the given action permission for.
// Returns nil predicate and nil error if user is superuser for projects or access is broadly granted (matches all).
// Returns a predicate that matches nothing if no access is found.
// Returns an error if an issue occurs.
func (self *PermissionsRepository) GetAccessibleProjectPredicates(
	ctx context.Context,
	userID uuid.UUID,
	action entSchema.PermittedAction,
) (predicate.Project, error) {
	groupIDs, err := self.getUserGroupIDs(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(groupIDs) == 0 {
		// No groups, implies no group-based permissions.
		// Return a predicate that matches nothing.
		return func(s *sql.Selector) { s.Where(sql.False()) }, nil
	}

	// Note: System superusers do not automatically have access to projects
	// They need specific project-level or team-level permissions

	impliedActions := self.getImpliedActions(action)

	return self.buildProjectPredicatesInternal(ctx, groupIDs, impliedActions)
}

// buildProjectPredicatesInternal is a helper to construct predicates for Project entities.
func (self *PermissionsRepository) buildProjectPredicatesInternal(
	ctx context.Context,
	groupIDs []uuid.UUID,
	impliedActions []entSchema.PermittedAction,
) (predicate.Project, error) {
	var projectPredicates []predicate.Project

	// 1. Check for "superuser" permission on ResourceTypeProject
	superuserPermissions, err := self.base.DB.Permission.Query().
		Where(
			permission.HasGroupsWith(group.IDIn(groupIDs...)),
			permission.ActionIn(impliedActions...),
			permission.ResourceTypeEQ(entSchema.ResourceTypeProject),
			func(s *sql.Selector) {
				sqljson.ValueEQ(permission.FieldResourceSelector, true, sqljson.Path("superuser"))
			},
		).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("error checking superuser project access: %w", err)
	}

	// Filter for actual superuser permissions (Go-side filtering)
	var hasSuperuser bool
	for _, p := range superuserPermissions {
		if p.ResourceSelector.Superuser {
			hasSuperuser = true
			break
		}
	}

	if hasSuperuser {
		// User has superuser access to all projects, return nil predicate
		return nil, nil
	}

	// 2. Direct access to specific Project IDs
	directProjectPermissions, err := self.base.DB.Permission.Query().
		Where(
			permission.HasGroupsWith(group.IDIn(groupIDs...)),
			permission.ActionIn(impliedActions...),
			permission.ResourceTypeEQ(entSchema.ResourceTypeProject),
			func(s *sql.Selector) { // Has an "id" field in resource_selector
				sqljson.ValueIsNotNull(permission.FieldResourceSelector, sqljson.Path("id"))
			},
		).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("error fetching direct project permissions: %w", err)
	}

	var specificProjectIDs []uuid.UUID
	for _, p := range directProjectPermissions {
		if p.ResourceSelector.ID != uuid.Nil {
			specificProjectIDs = append(specificProjectIDs, p.ResourceSelector.ID)
		}
	}
	if len(specificProjectIDs) > 0 {
		projectPredicates = append(projectPredicates, project.IDIn(specificProjectIDs...))
	}

	// 3. Hierarchical access: Projects belonging to accessible Teams
	// Find teams where the user has 'action' permission (direct or superuser for that team type)
	teamPermissions, err := self.base.DB.Permission.Query().
		Where(
			permission.HasGroupsWith(group.IDIn(groupIDs...)),
			permission.ActionIn(impliedActions...),
			permission.ResourceTypeEQ(entSchema.ResourceTypeTeam),
		).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("error fetching team permissions for project hierarchy: %w", err)
	}

	var accessibleTeamIDs []uuid.UUID
	foundGlobalSuperuserForTeamType := false
	for _, tp := range teamPermissions {
		if tp.ResourceSelector.Superuser { // Check if this permission grants superuser for ResourceTypeTeam
			foundGlobalSuperuserForTeamType = true
			break
		}
		if tp.ResourceSelector.ID != uuid.Nil {
			accessibleTeamIDs = append(accessibleTeamIDs, tp.ResourceSelector.ID)
		}
	}

	if foundGlobalSuperuserForTeamType {
		// User has a permission that makes them superuser for ResourceTypeTeam globally.
		// This implies access to ALL teams, and all projects in those teams
		return nil, nil
	}

	if len(accessibleTeamIDs) > 0 {
		projectPredicates = append(projectPredicates, project.HasTeamWith(team.IDIn(accessibleTeamIDs...)))
	}

	if len(projectPredicates) == 0 {
		// No specific permissions found, return a predicate that matches nothing.
		return func(s *sql.Selector) { s.Where(sql.False()) }, nil
	}

	return project.Or(projectPredicates...), nil
}

// GetAccessibleTeamPredicates returns Ent predicates for filtering teams
// that the user has the given action permission for.
func (self *PermissionsRepository) GetAccessibleTeamPredicates(
	ctx context.Context,
	userID uuid.UUID,
	action entSchema.PermittedAction,
) (predicate.Team, error) {
	groupIDs, err := self.getUserGroupIDs(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(groupIDs) == 0 {
		return func(s *sql.Selector) { s.Where(sql.False()) }, nil
	}

	// Note: System superusers do not automatically have access to teams
	// They need specific team-level permissions

	impliedActions := self.getImpliedActions(action)
	return self.buildTeamPredicatesInternal(ctx, groupIDs, impliedActions)
}

func (self *PermissionsRepository) buildTeamPredicatesInternal(
	ctx context.Context,
	groupIDs []uuid.UUID,
	impliedActions []entSchema.PermittedAction,
) (predicate.Team, error) {
	var teamPredicates []predicate.Team

	// 1. Check for "superuser" permission on ResourceTypeTeam
	superuserPermissions, err := self.base.DB.Permission.Query().
		Where(
			permission.HasGroupsWith(group.IDIn(groupIDs...)),
			permission.ActionIn(impliedActions...),
			permission.ResourceTypeEQ(entSchema.ResourceTypeTeam),
			func(s *sql.Selector) {
				sqljson.ValueEQ(permission.FieldResourceSelector, true, sqljson.Path("superuser"))
			},
		).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("error checking superuser team access: %w", err)
	}

	// Filter for actual superuser permissions (Go-side filtering)
	var hasSuperuser bool
	for _, p := range superuserPermissions {
		if p.ResourceSelector.Superuser {
			hasSuperuser = true
			break
		}
	}

	if hasSuperuser {
		return nil, nil
	}

	// 2. Direct access to specific Team IDs
	directTeamPermissions, err := self.base.DB.Permission.Query().
		Where(
			permission.HasGroupsWith(group.IDIn(groupIDs...)),
			permission.ActionIn(impliedActions...),
			permission.ResourceTypeEQ(entSchema.ResourceTypeTeam),
			func(s *sql.Selector) { // Has an "id" field in resource_selector
				sqljson.ValueIsNotNull(permission.FieldResourceSelector, sqljson.Path("id"))
			},
		).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("error fetching direct team permissions: %w", err)
	}

	var specificTeamIDs []uuid.UUID
	for _, p := range directTeamPermissions {
		if p.ResourceSelector.ID != uuid.Nil {
			specificTeamIDs = append(specificTeamIDs, p.ResourceSelector.ID)
		}
	}
	if len(specificTeamIDs) > 0 {
		teamPredicates = append(teamPredicates, team.IDIn(specificTeamIDs...))
	}

	// Teams are top-level in this hierarchy, so no further hierarchical checks needed here.

	if len(teamPredicates) == 0 {
		// No specific permissions found, and not superuser implies no access.
		return func(s *sql.Selector) { s.Where(sql.False()) }, nil
	}

	return team.Or(teamPredicates...), nil
}

// GetAccessibleEnvironmentPredicates returns Ent predicates for filtering environments.
// It can be scoped by an optional projectID.
func (self *PermissionsRepository) GetAccessibleEnvironmentPredicates(
	ctx context.Context,
	userID uuid.UUID,
	action entSchema.PermittedAction,
	projectID *uuid.UUID, // Optional: For scoping environments to a specific project
) (predicate.Environment, error) {
	groupIDs, err := self.getUserGroupIDs(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(groupIDs) == 0 {
		return func(s *sql.Selector) { s.Where(sql.False()) }, nil
	}

	// Note: System superusers do not automatically have access to environments
	// They need specific environment-level, project-level, or team-level permissions

	impliedActions := self.getImpliedActions(action)
	return self.buildEnvironmentPredicatesInternal(ctx, userID, groupIDs, action, impliedActions, projectID)
}

func (self *PermissionsRepository) buildEnvironmentPredicatesInternal(
	ctx context.Context,
	userID uuid.UUID,
	groupIDs []uuid.UUID,
	action entSchema.PermittedAction,
	impliedActions []entSchema.PermittedAction,
	projectID *uuid.UUID,
) (predicate.Environment, error) {
	var envPredicates []predicate.Environment

	// 1. Check for "superuser" permission on ResourceTypeEnvironment
	superuserPermissions, err := self.base.DB.Permission.Query().
		Where(
			permission.HasGroupsWith(group.IDIn(groupIDs...)),
			permission.ActionIn(impliedActions...),
			permission.ResourceTypeEQ(entSchema.ResourceTypeEnvironment),
			func(s *sql.Selector) {
				sqljson.ValueEQ(permission.FieldResourceSelector, true, sqljson.Path("superuser"))
			},
		).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("error checking superuser environment access: %w", err)
	}

	// Filter for actual superuser permissions (Go-side filtering)
	var hasSuperuser bool
	for _, p := range superuserPermissions {
		if p.ResourceSelector.Superuser {
			hasSuperuser = true
			break
		}
	}

	if hasSuperuser {
		// If superuser for environments, projectID scope still applies if provided.
		if projectID != nil {
			return environment.HasProjectWith(project.IDEQ(*projectID)), nil
		}
		return nil, nil
	}

	// 2. Direct access to specific Environment IDs
	directEnvPermissions, err := self.base.DB.Permission.Query().
		Where(
			permission.HasGroupsWith(group.IDIn(groupIDs...)),
			permission.ActionIn(impliedActions...),
			permission.ResourceTypeEQ(entSchema.ResourceTypeEnvironment),
			func(s *sql.Selector) { sqljson.ValueIsNotNull(permission.FieldResourceSelector, sqljson.Path("id")) },
		).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("error fetching direct environment permissions: %w", err)
	}
	var specificEnvIDs []uuid.UUID
	for _, p := range directEnvPermissions {
		if p.ResourceSelector.ID != uuid.Nil {
			specificEnvIDs = append(specificEnvIDs, p.ResourceSelector.ID)
		}
	}
	if len(specificEnvIDs) > 0 {
		envPredicates = append(envPredicates, environment.IDIn(specificEnvIDs...))
	}

	// 3. Hierarchical access: Environments belonging to accessible Projects or Teams
	//    a) Via Project access
	projectPerms, err := self.GetAccessibleProjectPredicates(ctx, userID, action)
	if err != nil {
		return nil, fmt.Errorf("error getting project predicates for env hierarchy: %w", err)
	}

	// Handle hierarchical access correctly
	if projectPerms == nil {
		// User has superuser access to projects, which grants access to all environments
		if projectID != nil {
			// Still scope to the specific project if requested
			return environment.HasProjectWith(project.IDEQ(*projectID)), nil
		}
		// Full superuser access to all environments
		return nil, nil
	} else {
		// User has specific project access (could be real access or no access)
		// We need to check if it's a meaningful predicate or a "false" predicate
		// For now, let's add it to the environment predicates and let the final logic handle it
		envPredicates = append(envPredicates, environment.HasProjectWith(projectPerms))
	}

	// Final combination
	if len(envPredicates) == 0 {
		// No specific permissions found, return a predicate that matches nothing
		return func(s *sql.Selector) { s.Where(sql.False()) }, nil
	}

	finalPredicate := environment.Or(envPredicates...)

	// Apply projectID scope if provided
	if projectID != nil {
		scopePredicate := environment.HasProjectWith(project.IDEQ(*projectID))
		return environment.And(finalPredicate, scopePredicate), nil
	}

	return finalPredicate, nil
}

// GetAccessibleServicePredicates returns Ent predicates for filtering services.
// It can be scoped by an optional environmentID.
func (self *PermissionsRepository) GetAccessibleServicePredicates(
	ctx context.Context,
	userID uuid.UUID,
	action entSchema.PermittedAction,
	environmentID *uuid.UUID, // Optional: For scoping services to a specific environment
) (predicate.Service, error) {
	groupIDs, err := self.getUserGroupIDs(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(groupIDs) == 0 {
		return func(s *sql.Selector) { s.Where(sql.False()) }, nil
	}

	// Note: System superusers do not automatically have access to services
	// They need specific service-level, environment-level, project-level, or team-level permissions

	impliedActions := self.getImpliedActions(action)
	return self.buildServicePredicatesInternal(ctx, userID, groupIDs, action, impliedActions, environmentID)
}

func (self *PermissionsRepository) buildServicePredicatesInternal(
	ctx context.Context,
	userID uuid.UUID,
	groupIDs []uuid.UUID,
	action entSchema.PermittedAction,
	impliedActions []entSchema.PermittedAction,
	environmentID *uuid.UUID,
) (predicate.Service, error) {
	var servicePredicates []predicate.Service

	// 1. Check for "superuser" permission on ResourceTypeService
	superuserPermissions, err := self.base.DB.Permission.Query().
		Where(
			permission.HasGroupsWith(group.IDIn(groupIDs...)),
			permission.ActionIn(impliedActions...),
			permission.ResourceTypeEQ(entSchema.ResourceTypeService),
			func(s *sql.Selector) {
				sqljson.ValueEQ(permission.FieldResourceSelector, true, sqljson.Path("superuser"))
			},
		).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("error checking superuser service access: %w", err)
	}

	// Filter for actual superuser permissions (Go-side filtering)
	var hasSuperuser bool
	for _, p := range superuserPermissions {
		if p.ResourceSelector.Superuser {
			hasSuperuser = true
			break
		}
	}

	if hasSuperuser {
		if environmentID != nil {
			return service.HasEnvironmentWith(environment.IDEQ(*environmentID)), nil
		}
		return nil, nil
	}

	// 2. Direct access to specific Service IDs
	directServicePermissions, err := self.base.DB.Permission.Query().
		Where(
			permission.HasGroupsWith(group.IDIn(groupIDs...)),
			permission.ActionIn(impliedActions...),
			permission.ResourceTypeEQ(entSchema.ResourceTypeService),
			func(s *sql.Selector) { sqljson.ValueIsNotNull(permission.FieldResourceSelector, sqljson.Path("id")) },
		).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("error fetching direct service permissions: %w", err)
	}
	var specificServiceIDs []uuid.UUID
	for _, p := range directServicePermissions {
		if p.ResourceSelector.ID != uuid.Nil {
			specificServiceIDs = append(specificServiceIDs, p.ResourceSelector.ID)
		}
	}
	if len(specificServiceIDs) > 0 {
		servicePredicates = append(servicePredicates, service.IDIn(specificServiceIDs...))
	}

	// 3. Hierarchical access: Services belonging to accessible Environments, Projects, or Teams
	//    a) Via Environment access
	envPreds, err := self.GetAccessibleEnvironmentPredicates(ctx, userID, action, nil)
	if err != nil {
		return nil, fmt.Errorf("error getting environment predicates for service hierarchy: %w", err)
	}

	// Handle hierarchical access correctly
	if envPreds == nil {
		// User has superuser access to environments (or higher), which grants access to all services
		if environmentID != nil {
			// Still scope to the specific environment if requested
			return service.HasEnvironmentWith(environment.IDEQ(*environmentID)), nil
		}
		// Full superuser access to all services
		return nil, nil
	} else {
		// User has specific environment access (could be real access or no access)
		// Add it to the service predicates and let the final logic handle it
		servicePredicates = append(servicePredicates, service.HasEnvironmentWith(envPreds))
	}

	// Final combination
	if len(servicePredicates) == 0 {
		// No specific permissions found, return a predicate that matches nothing
		return func(s *sql.Selector) { s.Where(sql.False()) }, nil
	}

	finalPredicate := service.Or(servicePredicates...)

	// Apply environmentID scope if provided
	if environmentID != nil {
		scopePredicate := service.HasEnvironmentWith(environment.IDEQ(*environmentID))
		return service.And(finalPredicate, scopePredicate), nil
	}

	return finalPredicate, nil
}
