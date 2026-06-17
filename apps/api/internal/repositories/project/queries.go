package project_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/environment"
	"github.com/unbindapp/unbind-api/ent/predicate"
	"github.com/unbindapp/unbind-api/ent/project"
	"github.com/unbindapp/unbind-api/internal/models"
)

func (self *ProjectRepository) GetByID(ctx context.Context, id uuid.UUID) (*ent.Project, error) {
	return self.base.DB.Project.Query().Where(project.ID(id)).WithTeam().WithEnvironments(
		func(eq *ent.EnvironmentQuery) {
			eq.Order(ent.Asc(environment.FieldCreatedAt))
		},
	).Only(ctx)
}

func (self *ProjectRepository) GetTeamID(ctx context.Context, id uuid.UUID) (uuid.UUID, error) {
	team, err := self.base.DB.Project.Query().Where(project.ID(id)).QueryTeam().Only(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	return team.ID, nil
}

func (self *ProjectRepository) GetByTeam(ctx context.Context, teamID uuid.UUID, authPredicate predicate.Project, sortField models.SortByField, sortOrder models.SortOrder) ([]*ent.Project, error) {
	q := self.base.DB.Project.Query().
		Where(project.TeamID(teamID)).
		WithEnvironments(func(eq *ent.EnvironmentQuery) {
			eq.Order(ent.Asc(environment.FieldCreatedAt))
		})

	if authPredicate != nil {
		q = q.Where(authPredicate)
	}

	if sortField != "" && sortOrder != "" {
		switch sortField {
		case models.SortByCreatedAt:
			q.Order(sortOrder.SortFunction()(project.FieldCreatedAt))
		case models.SortByUpdatedAt:
			q.Order(sortOrder.SortFunction()(project.FieldUpdatedAt))
		default:
			q.Order(ent.Asc(project.FieldCreatedAt))
		}
	} else {
		q.Order(ent.Asc(project.FieldCreatedAt))
	}

	return q.All(ctx)
}
