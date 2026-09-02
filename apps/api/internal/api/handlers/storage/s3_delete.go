package storage_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
)

type DeleteS3BucketInput struct {
	server.BaseAuthInput
	Body struct {
		ID     uuid.UUID `json:"id" format:"uuid" required:"true"`
		TeamID uuid.UUID `json:"team_id" format:"uuid" required:"true"`
	}
}

type DeleteS3BucketOutput struct {
	Body struct {
		Data server.DeletedResponse `json:"data"`
	}
}

func (self *HandlerGroup) DeleteS3Bucket(ctx context.Context, input *DeleteS3BucketInput) (*DeleteS3BucketOutput, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	err = self.srv.StorageService.DeleteS3BucketByID(ctx, user.ID, input.Body.TeamID, input.Body.ID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &DeleteS3BucketOutput{}
	resp.Body.Data = server.DeletedResponse{
		ID:      input.Body.ID.String(),
		Deleted: true,
	}
	return resp, nil
}
