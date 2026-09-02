package storage_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type GetS3BucketByIDInput struct {
	server.BaseAuthInput
	ID     uuid.UUID `query:"id" format:"uuid" required:"true"`
	TeamID uuid.UUID `query:"team_id" format:"uuid" required:"true"`
}

type GetS3BucketByIDOutput struct {
	Body struct {
		Data *models.S3BucketResponse `json:"data"`
	}
}

func (self *HandlerGroup) GetS3BucketByID(ctx context.Context, input *GetS3BucketByIDInput) (*GetS3BucketByIDOutput, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	s3Bucket, err := self.srv.StorageService.GetS3BucketByID(ctx, user.ID, input.TeamID, input.ID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GetS3BucketByIDOutput{}
	resp.Body.Data = s3Bucket
	return resp, nil
}

type ListS3BucketsInput struct {
	server.BaseAuthInput
	TeamID uuid.UUID `query:"team_id" format:"uuid" required:"true"`
}

type ListS3BucketsOutput struct {
	Body struct {
		Data []*models.S3BucketResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListS3Buckets(ctx context.Context, input *ListS3BucketsInput) (*ListS3BucketsOutput, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	s3Buckets, err := self.srv.StorageService.ListS3Buckets(ctx, user.ID, input.TeamID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListS3BucketsOutput{}
	resp.Body.Data = s3Buckets
	return resp, nil
}
