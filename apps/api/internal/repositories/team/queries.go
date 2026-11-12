package team_repo

import (
	"context"
	"slices"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/group"
	"github.com/unbindapp/unbind-api/ent/permission"
	"github.com/unbindapp/unbind-api/ent/predicate"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/ent/team"
	"github.com/unbindapp/unbind-api/ent/user"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

func (self *TeamRepository) GetAll(ctx context.Context, authPredicate predicate.Team) ([]*ent.Team, error) {
	q := self.base.DB.Team.Query().WithIcon(withIconTime)
	if authPredicate != nil {
		q = q.Where(authPredicate)
	}
	return q.All(ctx)
}

func (self *TeamRepository) GetByID(ctx context.Context, id uuid.UUID) (*ent.Team, error) {
	return self.base.DB.Team.Query().
		Where(team.ID(id)).
		WithIcon(withIconTime).
		WithProjects(func(pq *ent.ProjectQuery) {
			pq.WithEnvironments(
				func(eq *ent.EnvironmentQuery) {
					eq.WithServices(
						func(sq *ent.ServiceQuery) {
							sq.WithGithubInstallation(
								func(giq *ent.GithubInstallationQuery) {
									giq.WithGithubApp()
								},
							)
							sq.WithServiceConfig()
						},
					)
				},
			)
		}).
		Only(ctx)
}

func (self *TeamRepository) GetNamespace(ctx context.Context, id uuid.UUID) (string, error) {
	team, err := self.base.DB.Team.Query().
		Select(team.FieldNamespace).
		Where(team.ID(id)).
		Only(ctx)
	if err != nil {
		return "", err
	}
	return team.Namespace, nil
}

func (self *TeamRepository) HasUserWithID(ctx context.Context, teamID uuid.UUID, userID uuid.UUID) (bool, error) {
	return self.base.DB.User.Query().
		Where(user.ID(userID)).
		QueryTeams().
		Where(team.ID(teamID)).
		Exist(ctx)
}

func (self *TeamRepository) GetNames(ctx context.Context, tx repository.TxInterface) ([]string, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	return db.Team.Query().Select(team.FieldName).Strings(ctx)
}

// GetRoleGroups returns the team's role groups with their members loaded.
func (self *TeamRepository) GetRoleGroups(ctx context.Context, teamID uuid.UUID) ([]*ent.Group, error) {
	return self.base.DB.Team.Query().
		Where(team.ID(teamID)).
		QueryRoleGroups().
		WithUsers().
		All(ctx)
}

// Empty until the project gets its first member.
func (self *TeamRepository) GetProjectRoleGroups(ctx context.Context, projectID uuid.UUID) ([]*ent.Group, error) {
	return self.base.DB.Group.Query().
		Where(group.ProjectID(projectID)).
		WithUsers().
		All(ctx)
}

type MemberScope struct {
	TeamID    uuid.UUID
	ProjectID *uuid.UUID
}

func (self MemberScope) ReachedBy(grant *ent.Permission) bool {
	switch grant.ResourceType {
	case schema.ResourceTypeTeam:
		return grant.ResourceSelector.Superuser || grant.ResourceSelector.ID == self.TeamID
	case schema.ResourceTypeProject:
		return self.ProjectID != nil && (grant.ResourceSelector.Superuser || grant.ResourceSelector.ID == *self.ProjectID)
	default:
		return false
	}
}

// GetGroupsReachingTeam returns every group that is not one of the team's own
// role groups but holds a grant on the team, with members and grants loaded.
// Their members reach the team without being on it.
func (self *TeamRepository) GetGroupsReachingTeam(ctx context.Context, teamID uuid.UUID) ([]*ent.Group, error) {
	return self.groupsReaching(ctx, MemberScope{TeamID: teamID}, group.Or(group.TeamIDIsNil(), group.TeamIDNEQ(teamID)))
}

// Includes the role groups of the project's team: its members reach every project.
func (self *TeamRepository) GetGroupsReachingProject(ctx context.Context, teamID, projectID uuid.UUID) ([]*ent.Group, error) {
	scope := MemberScope{TeamID: teamID, ProjectID: &projectID}
	return self.groupsReaching(ctx, scope, group.Or(group.ProjectIDIsNil(), group.ProjectIDNEQ(projectID)))
}

func (self *TeamRepository) groupsReaching(ctx context.Context, scope MemberScope, notOwnRoleGroup predicate.Group) ([]*ent.Group, error) {
	grantTypes := permission.ResourceTypeIn(schema.ResourceTypeTeam, schema.ResourceTypeProject)
	groups, err := self.base.DB.Group.Query().
		Where(notOwnRoleGroup, group.HasPermissionsWith(grantTypes)).
		WithUsers().
		WithPermissions(func(q *ent.PermissionQuery) {
			q.Where(grantTypes)
		}).
		All(ctx)
	if err != nil {
		return nil, err
	}

	var reaching []*ent.Group
	for _, g := range groups {
		if slices.ContainsFunc(g.Edges.Permissions, scope.ReachedBy) {
			reaching = append(reaching, g)
		}
	}
	return reaching, nil
}
