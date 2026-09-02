package storage_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type UpdateS3BucketInput struct {
	server.BaseAuthInput
	Body *models.S3BucketUpdateInput
}

type UpdateS3BucketOutput struct {
	Body struct {
		Data *models.S3BucketResponse `json:"data"`
	}
}

func (self *HandlerGroup) UpdateS3Bucket(ctx context.Context, input *UpdateS3BucketInput) (*UpdateS3BucketOutput, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	s3Bucket, err := self.srv.StorageService.UpdateS3Bucket(ctx, user.ID, input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &UpdateS3BucketOutput{}
	resp.Body.Data = s3Bucket
	return resp, nil
}
