package s3_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

func (self *S3Repository) Create(ctx context.Context, tx repository.TxInterface, teamID uuid.UUID, name, endpoint, region, kubernetesSecret string) (*ent.S3, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	// Create s3
	return db.S3.Create().
		SetTeamID(teamID).
		SetName(name).
		SetEndpoint(endpoint).
		SetRegion(region).
		SetKubernetesSecret(kubernetesSecret).
		Save(ctx)
}

func (self *S3Repository) Delete(ctx context.Context, tx repository.TxInterface, id uuid.UUID) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	// Delete s3
	return db.S3.DeleteOneID(id).Exec(ctx)
}

func (self *S3Repository) Update(ctx context.Context, id uuid.UUID, name string) (*ent.S3, error) {
	// Update s3
	return self.base.DB.S3.UpdateOneID(id).
		SetName(name).
		Save(ctx)
}
