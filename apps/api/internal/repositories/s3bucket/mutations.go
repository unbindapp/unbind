package s3bucket_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

type CreateS3BucketInput struct {
	TeamID           uuid.UUID
	Name             string
	Endpoint         string
	Region           string
	Bucket           string
	KubernetesSecret string
}

func (self *S3BucketRepository) Create(ctx context.Context, tx repository.TxInterface, input *CreateS3BucketInput) (*ent.S3Bucket, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	return db.S3Bucket.Create().
		SetTeamID(input.TeamID).
		SetName(input.Name).
		SetEndpoint(input.Endpoint).
		SetRegion(input.Region).
		SetBucket(input.Bucket).
		SetKubernetesSecret(input.KubernetesSecret).
		Save(ctx)
}

type UpdateS3BucketInput struct {
	Name     *string
	Endpoint *string
	Region   *string
	Bucket   *string
}

func (self *S3BucketRepository) Update(ctx context.Context, id uuid.UUID, input *UpdateS3BucketInput) (*ent.S3Bucket, error) {
	return self.base.DB.S3Bucket.UpdateOneID(id).
		SetNillableName(input.Name).
		SetNillableEndpoint(input.Endpoint).
		SetNillableRegion(input.Region).
		SetNillableBucket(input.Bucket).
		Save(ctx)
}

func (self *S3BucketRepository) Delete(ctx context.Context, tx repository.TxInterface, id uuid.UUID) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	return db.S3Bucket.DeleteOneID(id).Exec(ctx)
}
