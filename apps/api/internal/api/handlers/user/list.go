package user_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListUsersResponse struct {
	Body struct {
		Data []*models.UserResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListUsers(ctx context.Context, input *server.BaseAuthInput) (*ListUsersResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	users, err := self.srv.UserService.ListUsers(ctx, user.ID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListUsersResponse{}
	resp.Body.Data = models.TransformUserEntities(users)
	return resp, nil
}
