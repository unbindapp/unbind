package environment_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/environment"
	"github.com/unbindapp/unbind-api/ent/predicate"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

func (self *EnvironmentRepository) GetByID(ctx context.Context, id uuid.UUID) (*ent.Environment, error) {
	return self.base.DB.Environment.Query().Where(environment.ID(id)).WithProject(func(q *ent.ProjectQuery) {
		q.WithTeam()
	}).Only(ctx)
}

// Return all environments for a project with service edge populated
func (self *EnvironmentRepository) GetForProject(ctx context.Context, tx repository.TxInterface, projectID uuid.UUID, authPredicate predicate.Environment) ([]*ent.Environment, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	q := db.Environment.Query().Where(environment.ProjectID(projectID)).
		WithServices().Order(
		ent.Asc(environment.FieldCreatedAt),
	)

	if authPredicate != nil {
		q = q.Where(authPredicate)
	}

	return q.All(ctx)
}
