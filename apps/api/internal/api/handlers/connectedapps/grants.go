package connectedapps_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListInput struct {
	server.BaseAuthInput
}

type ListResponse struct {
	Body struct {
		Data []*models.ConnectedAppResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) List(ctx context.Context, input *ListInput) (*ListResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	grants, err := self.srv.OAuthServerService.ListGrants(ctx, user.ID)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ListResponse{}
	resp.Body.Data = grants
	return resp, nil
}

type RevokeInput struct {
	server.BaseAuthInput
	Body *models.ConnectedAppRevokeInput
}

type RevokeResponse struct {
	Body struct {
		Data server.DeletedResponse `json:"data"`
	}
}

func (self *HandlerGroup) Revoke(ctx context.Context, input *RevokeInput) (*RevokeResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if err := self.srv.OAuthServerService.RevokeGrant(ctx, user.ID, input.Body.ID); err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &RevokeResponse{}
	resp.Body.Data = server.DeletedResponse{ID: input.Body.ID.String(), Deleted: true}
	return resp, nil
}
