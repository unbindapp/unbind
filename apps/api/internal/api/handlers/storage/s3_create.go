package storage_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type CreateS3BucketInput struct {
	server.BaseAuthInput
	Body *models.S3BucketCreateInput
}

type CreateS3BucketOutput struct {
	Body struct {
		Data *models.S3BucketResponse `json:"data"`
	}
}

func (self *HandlerGroup) CreateS3Bucket(ctx context.Context, input *CreateS3BucketInput) (*CreateS3BucketOutput, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	s3Bucket, err := self.srv.StorageService.CreateS3Bucket(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &CreateS3BucketOutput{}
	resp.Body.Data = s3Bucket
	return resp, nil
}
