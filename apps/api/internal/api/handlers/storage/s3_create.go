package storage_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type CreateS3Input struct {
	server.BaseAuthInput
	Body *models.S3BackendCreateInput
}

type CreateS3Output struct {
	Body struct {
		Data *models.S3Response `json:"data"`
	}
}

func (self *HandlerGroup) CreateS3(ctx context.Context, input *CreateS3Input) (*CreateS3Output, error) {
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	s3source, err := self.srv.StorageService.CreateS3StorageBackend(
		ctx,
		user.ID,
		bearerToken,
		input.Body,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &CreateS3Output{}
	resp.Body.Data = s3source
	return resp, nil
}
