package project_repo

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/environment"
	"github.com/unbindapp/unbind-api/ent/project"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

func (self *ProjectRepository) Create(ctx context.Context, tx repository.TxInterface, teamID uuid.UUID, kubernetesName, name string, description *string, kubernetesSecret string) (*ent.Project, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	// New projects go to the top of the custom order
	positions, err := db.Project.Query().
		Where(project.TeamID(teamID)).
		Order(project.ByPosition()).
		Limit(1).
		Select(project.FieldPosition).
		Ints(ctx)
	if err != nil {
		return nil, err
	}
	position := repository.PositionAbove(positions)

	return db.Project.Create().
		SetTeamID(teamID).
		SetKubernetesName(kubernetesName).
		SetName(name).
		SetNillableDescription(description).
		SetKubernetesSecret(kubernetesSecret).
		SetPosition(position).
		Save(ctx)
}

// Reorder puts the given projects first, in the given order. The team's other
// projects follow in the order they had.
func (self *ProjectRepository) Reorder(ctx context.Context, tx repository.TxInterface, teamID uuid.UUID, projectIDs []uuid.UUID) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	current, err := db.Project.Query().
		Where(project.TeamID(teamID)).
		Order(projectOrder(models.SortByCustom, models.SortOrderAsc)...).
		Select(project.FieldID, project.FieldPosition, project.FieldUpdatedAt).
		All(ctx)
	if err != nil {
		return err
	}

	items := make([]repository.Positioned, len(current))
	updatedAt := make(map[uuid.UUID]time.Time, len(current))
	for i, p := range current {
		items[i] = repository.Positioned{ID: p.ID, Position: p.Position}
		updatedAt[p.ID] = p.UpdatedAt
	}

	changed, err := repository.Arrange(items, projectIDs, func(id uuid.UUID) string {
		return fmt.Sprintf("Project %s is not in this team", id)
	})
	if err != nil {
		return err
	}

	for _, id := range repository.WriteOrder(changed) {
		// Moving a project is not an edit of it, so updated_at stays
		if err := db.Project.UpdateOneID(id).
			SetPosition(changed[id]).
			SetUpdatedAt(updatedAt[id]).
			Exec(ctx); err != nil {
			return err
		}
	}

	return nil
}

// ClearDefaultEnvironment is intended for cases where we delete the last environment in a project
func (self *ProjectRepository) ClearDefaultEnvironment(ctx context.Context, tx repository.TxInterface, projectID uuid.UUID) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	return db.Project.UpdateOneID(projectID).ClearDefaultEnvironment().Exec(ctx)
}

func (self *ProjectRepository) Update(ctx context.Context, tx repository.TxInterface, projectID uuid.UUID, defaultEnvironmentID *uuid.UUID, name string, description *string) (*ent.Project, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	m := db.Project.UpdateOneID(projectID)
	if name != "" {
		m.SetName(name)
	}
	if description != nil {
		// Reset on empty string
		if *description == "" {
			m.ClearDescription()
		} else {
			m.SetDescription(*description)
		}
	}
	if defaultEnvironmentID != nil {
		// Make sure it belongs to the project
		envs, err := db.Project.Query().Where(project.ID(projectID)).QueryEnvironments().Select(environment.FieldID).All(ctx)
		if err != nil {
			return nil, err
		}
		found := false
		for _, env := range envs {
			if env.ID == *defaultEnvironmentID {
				found = true
				break
			}
		}
		if !found {
			return nil, &ent.NotFoundError{}
		}
		m.SetDefaultEnvironmentID(*defaultEnvironmentID)
	}
	return m.Save(ctx)
}

func (self *ProjectRepository) Delete(ctx context.Context, tx repository.TxInterface, projectID uuid.UUID) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	return db.Project.DeleteOneID(projectID).Exec(ctx)
}
