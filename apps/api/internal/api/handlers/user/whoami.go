package user_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

type WhoamiData struct {
	models.UserResponse
	SystemPermissions []schema.PermittedAction `json:"system_permissions" nullable:"false" doc:"Actions the current user can perform on system-wide resources"`
	APIKey            *WhoamiAPIKey            `json:"api_key,omitempty" required:"false" doc:"Present when the request was authenticated with an API key or a connected app: the limit the credential puts on this user"`
}

// WhoamiAPIKey lets a key holder (a CLI, an MCP server) learn what the key allows
// before trying.
type WhoamiAPIKey struct {
	Role         schema.PermittedAction  `json:"role"`
	FullAccess   bool                    `json:"full_access"`
	Resources    []schema.APIKeyResource `json:"resources" nullable:"false"`
	Capabilities []schema.KeyCapability  `json:"capabilities" nullable:"false" doc:"What the credential may see beyond its role. Without variable_values, variable values come back blank; without logs, query-logs is refused; without webhook_urls, webhook URLs come back blank."`
}

type WhoamiResponse struct {
	Body struct {
		Data *WhoamiData `json:"data"`
	}
}

// Whoami handles GET /whoami
func (self *HandlerGroup) Whoami(ctx context.Context, _ *server.BaseAuthInput) (*WhoamiResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	permSet, err := self.srv.Repository.Permissions().GetUserPermissionSet(ctx, user.ID)
	if err != nil {
		return nil, err
	}

	resp := &WhoamiResponse{}
	resp.Body.Data = &WhoamiData{
		UserResponse:      *models.TransformUserEntity(user),
		SystemPermissions: permSet.SystemActions(),
	}
	if access, ok := permissions_repo.APIKeyAccessFromContext(ctx); ok {
		resources := access.Resources
		if resources == nil {
			resources = []schema.APIKeyResource{}
		}
		capabilities := access.Capabilities
		if capabilities == nil {
			capabilities = []schema.KeyCapability{}
		}
		resp.Body.Data.APIKey = &WhoamiAPIKey{Role: access.Role, FullAccess: access.FullAccess, Resources: resources, Capabilities: capabilities}
	}
	return resp, nil
}
