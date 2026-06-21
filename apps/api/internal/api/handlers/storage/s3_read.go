package storage_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type GetS3SourceByIDInput struct {
	server.BaseAuthInput
	ID          uuid.UUID `query:"id" format:"uuid" required:"true"`
	TeamID      uuid.UUID `query:"team_id" format:"uuid" required:"true"`
	WithBuckets bool      `query:"with_buckets"`
}

type GetS3SourceByIDOutput struct {
	Body struct {
		Data *models.S3Response `json:"data"`
	}
}

func (self *HandlerGroup) GetS3SourceByID(ctx context.Context, input *GetS3SourceByIDInput) (*GetS3SourceByIDOutput, error) {
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	s3Source, err := self.srv.StorageService.GetS3StorageByID(
		ctx,
		user.ID,
		bearerToken,
		input.TeamID,
		input.ID,
		input.WithBuckets,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GetS3SourceByIDOutput{}
	resp.Body.Data = s3Source
	return resp, nil
}

type ListS3SourceInput struct {
	server.BaseAuthInput
	TeamID      uuid.UUID `query:"team_id" format:"uuid" required:"true"`
	WithBuckets bool      `query:"with_buckets"`
}

type ListS3SourceOutput struct {
	Body struct {
		Data []*models.S3Response `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListS3Source(ctx context.Context, input *ListS3SourceInput) (*ListS3SourceOutput, error) {
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	s3Sources, err := self.srv.StorageService.ListS3StorageBackends(
		ctx,
		user.ID,
		bearerToken,
		input.TeamID,
		input.WithBuckets,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListS3SourceOutput{}
	resp.Body.Data = s3Sources
	return resp, nil
}
