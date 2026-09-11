package user_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type MeData struct {
	models.UserResponse
	SystemPermissions []schema.PermittedAction `json:"system_permissions" nullable:"false" doc:"Actions the current user can perform on system-wide resources"`
}

type MeResponse struct {
	Body struct {
		Data *MeData `json:"data"`
	}
}

// Me handles GET /me
func (self *HandlerGroup) Me(ctx context.Context, _ *server.BaseAuthInput) (*MeResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	permSet, err := self.srv.Repository.Permissions().GetUserPermissionSet(ctx, user.ID)
	if err != nil {
		return nil, err
	}

	resp := &MeResponse{}
	resp.Body.Data = &MeData{
		UserResponse:      *models.TransformUserEntity(user),
		SystemPermissions: permSet.SystemActions(),
	}
	return resp, nil
}
