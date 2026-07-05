package user_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
)

type DeleteUserInput struct {
	server.BaseAuthInput
	Body struct {
		UserID uuid.UUID `json:"user_id" format:"uuid" required:"true"`
	}
}

type DeleteUserResponse struct {
	Body struct {
		Data server.DeletedResponse `json:"data"`
	}
}

func (self *HandlerGroup) DeleteUser(ctx context.Context, input *DeleteUserInput) (*DeleteUserResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if err := self.srv.UserService.DeleteUser(ctx, user.ID, input.Body.UserID); err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &DeleteUserResponse{}
	resp.Body.Data = server.DeletedResponse{
		ID:      input.Body.UserID.String(),
		Deleted: true,
	}
	return resp, nil
}
