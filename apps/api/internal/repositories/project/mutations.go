package project_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/environment"
	"github.com/unbindapp/unbind-api/ent/project"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

func (self *ProjectRepository) Create(ctx context.Context, tx repository.TxInterface, teamID uuid.UUID, kubernetesName, name string, description *string, kubernetesSecret string) (*ent.Project, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	// Create the project in the database
	return db.Project.Create().
		SetTeamID(teamID).
		SetKubernetesName(kubernetesName).
		SetName(name).
		SetNillableDescription(description).
		SetKubernetesSecret(kubernetesSecret).
		Save(ctx)
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
		// Set the default environment
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
