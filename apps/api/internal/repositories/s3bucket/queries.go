package s3bucket_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/s3bucket"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

func (self *S3BucketRepository) GetByID(ctx context.Context, id uuid.UUID) (*ent.S3Bucket, error) {
	return self.base.DB.S3Bucket.
		Query().
		Where(s3bucket.ID(id)).
		Only(ctx)
}

func (self *S3BucketRepository) GetByTeam(ctx context.Context, teamID uuid.UUID) ([]*ent.S3Bucket, error) {
	return self.base.DB.S3Bucket.
		Query().
		Where(s3bucket.TeamIDEQ(teamID)).
		Order(ent.Desc(s3bucket.FieldCreatedAt)).
		All(ctx)
}

func (self *S3BucketRepository) GetNamesByTeam(ctx context.Context, tx repository.TxInterface, teamID uuid.UUID) ([]string, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	return db.S3Bucket.Query().Where(s3bucket.TeamID(teamID)).Select(s3bucket.FieldName).Strings(ctx)
}
