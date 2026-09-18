package user_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

type MeData struct {
	models.UserResponse
	SystemPermissions []schema.PermittedAction `json:"system_permissions" nullable:"false" doc:"Actions the current user can perform on system-wide resources"`
	APIKey            *MeAPIKey                `json:"api_key,omitempty" required:"false" doc:"Present when the request was authenticated with an API key or a connected app: the limit the credential puts on this user"`
}

// MeAPIKey lets a key holder (a CLI, an MCP server) learn what the key allows
// before trying.
type MeAPIKey struct {
	Role       schema.PermittedAction  `json:"role"`
	FullAccess bool                    `json:"full_access"`
	Resources  []schema.APIKeyResource `json:"resources" nullable:"false"`
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
	if access, ok := permissions_repo.APIKeyAccessFromContext(ctx); ok {
		resources := access.Resources
		if resources == nil {
			resources = []schema.APIKeyResource{}
		}
		resp.Body.Data.APIKey = &MeAPIKey{Role: access.Role, FullAccess: access.FullAccess, Resources: resources}
	}
	return resp, nil
}
