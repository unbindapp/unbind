package user_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type MeResponse struct {
	Body struct {
		Data *models.UserResponse `json:"data"`
	}
}

// Me handles GET /me
func (self *HandlerGroup) Me(ctx context.Context, _ *server.BaseAuthInput) (*MeResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	resp := &MeResponse{}
	resp.Body.Data = models.TransformUserEntity(user)
	return resp, nil
}
