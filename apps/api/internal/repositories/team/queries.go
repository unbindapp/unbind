package team_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/predicate"
	"github.com/unbindapp/unbind-api/ent/team"
	"github.com/unbindapp/unbind-api/ent/user"
)

func (self *TeamRepository) GetAll(ctx context.Context, authPredicate predicate.Team) ([]*ent.Team, error) {
	q := self.base.DB.Team.Query()
	if authPredicate != nil {
		q = q.Where(authPredicate)
	}
	return q.All(ctx)
}

func (self *TeamRepository) GetByID(ctx context.Context, id uuid.UUID) (*ent.Team, error) {
	return self.base.DB.Team.Query().
		Where(team.ID(id)).
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
