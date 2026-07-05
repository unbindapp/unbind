package user_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
	user_service "github.com/unbindapp/unbind-api/internal/services/user"
)

type UpdatePasswordInput struct {
	server.BaseAuthInput
	Body struct {
		UserID          *uuid.UUID `json:"user_id,omitempty" format:"uuid" doc:"Defaults to the authenticated user; changing another user's password requires system admin"`
		CurrentPassword string     `json:"current_password,omitempty" doc:"Required when changing your own password"`
		NewPassword     string     `json:"new_password" required:"true" minLength:"8"`
	}
}

type UpdatePasswordResponse struct {
	Body struct {
		Data *models.UserResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) UpdatePassword(ctx context.Context, input *UpdatePasswordInput) (*UpdatePasswordResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	updated, err := self.srv.UserService.UpdatePassword(ctx, user.ID, &user_service.UpdatePasswordInput{
		UserID:          input.Body.UserID,
		CurrentPassword: input.Body.CurrentPassword,
		NewPassword:     input.Body.NewPassword,
	})
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &UpdatePasswordResponse{}
	resp.Body.Data = models.TransformUserEntity(updated)
	return resp, nil
}
