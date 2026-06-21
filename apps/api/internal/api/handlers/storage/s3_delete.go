package storage_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
)

type DeleteS3SourceByIDInput struct {
	server.BaseAuthInput
	Body struct {
		ID     uuid.UUID `json:"id" format:"uuid" required:"true"`
		TeamID uuid.UUID `json:"team_id" format:"uuid" required:"true"`
	}
}

type DeleteS3SourceByIDOutput struct {
	Body struct {
		Data server.DeletedResponse `json:"data"`
	}
}

func (self *HandlerGroup) DeleteS3Source(ctx context.Context, input *DeleteS3SourceByIDInput) (*DeleteS3SourceByIDOutput, error) {
	user, bearerToken, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	err = self.srv.StorageService.DeleteS3StorageByID(
		ctx,
		user.ID,
		bearerToken,
		input.Body.TeamID,
		input.Body.ID,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &DeleteS3SourceByIDOutput{}
	resp.Body.Data = server.DeletedResponse{
		ID:      input.Body.ID.String(),
		Deleted: true,
	}
	return resp, nil
}
