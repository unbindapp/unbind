package storage_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type TestS3AccessInput struct {
	server.BaseAuthInput
	Body *models.S3AccessTestInput
}

type TestS3Output struct {
	Body struct {
		Data *models.S3TestResult `json:"data"`
	}
}

func (self *HandlerGroup) TestS3Access(ctx context.Context, input *TestS3AccessInput) (*TestS3Output, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	result, err := self.srv.StorageService.TestS3Access(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &TestS3Output{}
	resp.Body.Data = result
	return resp, nil
}

type TestStoredS3BucketInput struct {
	server.BaseAuthInput
	Body struct {
		TeamID uuid.UUID `json:"team_id" format:"uuid" required:"true" doc:"ID of the team that owns the S3 bucket"`
		ID     uuid.UUID `json:"id" format:"uuid" required:"true" doc:"ID of the S3 bucket, from list-s3-buckets"`
	}
}

func (self *HandlerGroup) TestStoredS3Bucket(ctx context.Context, input *TestStoredS3BucketInput) (*TestS3Output, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	result, err := self.srv.StorageService.TestStoredS3Bucket(ctx, user.ID, input.Body.TeamID, input.Body.ID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &TestS3Output{}
	resp.Body.Data = result
	return resp, nil
}
