package user_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type UserCreateInput struct {
	server.BaseAuthInput
	Body struct {
		Email    string `json:"email" format:"email" required:"true"`
		Password string `json:"password" required:"true" minLength:"8"`
	}
}

type UserCreateResponse struct {
	Body struct {
		Data *models.UserResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) CreateUser(ctx context.Context, input *UserCreateInput) (*UserCreateResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	created, err := self.srv.UserService.CreateUser(ctx, user.ID, input.Body.Email, input.Body.Password)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &UserCreateResponse{}
	resp.Body.Data = models.TransformUserEntity(created)
	return resp, nil
}
