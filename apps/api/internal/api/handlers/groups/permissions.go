package groups_handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListGroupPermissionsInput struct {
	server.BaseAuthInput
	GroupID uuid.UUID `query:"group_id" format:"uuid" required:"true"`
}

type ListGroupPermissionsResponse struct {
	Body struct {
		Data []*models.PermissionResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListGroupPermissions(ctx context.Context, input *ListGroupPermissionsInput) (*ListGroupPermissionsResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	permissions, err := self.srv.GroupService.GetGroupPermissions(ctx, user.ID, input.GroupID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListGroupPermissionsResponse{}
	resp.Body.Data = models.TransformPermissionEntities(permissions)
	return resp, nil
}

type GrantGroupPermissionInput struct {
	server.BaseAuthInput
	Body struct {
		GroupID      uuid.UUID              `json:"group_id" format:"uuid" required:"true"`
		Action       schema.PermittedAction `json:"action" required:"true"`
		ResourceType schema.ResourceType    `json:"resource_type" required:"true"`
		ResourceID   *uuid.UUID             `json:"resource_id,omitempty" format:"uuid" doc:"Specific resource to grant access to; omit when superuser is true"`
		Superuser    bool                   `json:"superuser,omitempty" doc:"Grant access to every resource of this type"`
	}
}

type GrantGroupPermissionResponse struct {
	Body struct {
		Data *models.PermissionResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) GrantGroupPermission(ctx context.Context, input *GrantGroupPermissionInput) (*GrantGroupPermissionResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if input.Body.ResourceID == nil && !input.Body.Superuser {
		return nil, oapi.MapError(errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Either resource_id or superuser must be provided"))
	}

	selector := schema.ResourceSelector{Superuser: input.Body.Superuser}
	if input.Body.ResourceID != nil {
		selector.ID = *input.Body.ResourceID
	}

	permission, err := self.srv.GroupService.GrantPermissionToGroup(
		ctx,
		user.ID,
		input.Body.GroupID,
		input.Body.Action,
		input.Body.ResourceType,
		selector,
	)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &GrantGroupPermissionResponse{}
	resp.Body.Data = models.TransformPermissionEntity(permission)
	return resp, nil
}

type RevokeGroupPermissionInput struct {
	server.BaseAuthInput
	Body struct {
		GroupID      uuid.UUID `json:"group_id" format:"uuid" required:"true"`
		PermissionID uuid.UUID `json:"permission_id" format:"uuid" required:"true"`
	}
}

type RevokeGroupPermissionResponse struct {
	Body struct {
		Data server.DeletedResponse `json:"data"`
	}
}

func (self *HandlerGroup) RevokeGroupPermission(ctx context.Context, input *RevokeGroupPermissionInput) (*RevokeGroupPermissionResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if err := self.srv.GroupService.RevokePermissionFromGroup(ctx, user.ID, input.Body.GroupID, input.Body.PermissionID); err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &RevokeGroupPermissionResponse{}
	resp.Body.Data = server.DeletedResponse{
		ID:      input.Body.PermissionID.String(),
		Deleted: true,
	}
	return resp, nil
}
