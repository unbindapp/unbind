package setup_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
)

type CreateUserInput struct {
	Body struct {
		Email    string `json:"email" required:"true" format:"email"`
		Password string `json:"password" required:"true" minLength:"6"`
	}
}

type UserData struct {
	Email string `json:"email" required:"true" format:"email"`
}

type CreateUserResponse struct {
	Body struct {
		Data *UserData `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) CreateUser(ctx context.Context, input *CreateUserInput) (*CreateUserResponse, error) {
	user, err := self.srv.Repository.Bootstrap().CreateUser(
		ctx,
		input.Body.Email,
		input.Body.Password,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &CreateUserResponse{}
	resp.Body.Data = &UserData{
		Email: user.Email,
	}
	return resp, nil

}
