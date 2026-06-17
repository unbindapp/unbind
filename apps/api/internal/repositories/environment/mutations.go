package environment_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

func (self *EnvironmentRepository) Create(ctx context.Context, tx repository.TxInterface, kubernetesName, name, kuberneteSecret string, description *string, projectID uuid.UUID) (*ent.Environment, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	return db.Environment.Create().
		SetKubernetesName(kubernetesName).
		SetName(name).
		SetNillableDescription(description).
		SetProjectID(projectID).
		SetKubernetesSecret(kuberneteSecret).
		Save(ctx)
}

func (self *EnvironmentRepository) Delete(ctx context.Context, tx repository.TxInterface, environmentID uuid.UUID) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}

	return db.Environment.DeleteOneID(environmentID).Exec(ctx)
}

func (self *EnvironmentRepository) Update(ctx context.Context, environmentID uuid.UUID, name *string, description *string) (*ent.Environment, error) {
	upd := self.base.DB.Environment.UpdateOneID(environmentID)
	if name != nil {
		upd.SetName(*name)
	}
	if description != nil {
		upd.SetNillableDescription(description)
	}
	return upd.Save(ctx)
}
