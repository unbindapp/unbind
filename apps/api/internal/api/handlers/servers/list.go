package servers_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

type ListServersResponse struct {
	Body struct {
		Data []*models.ServerResponse `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) ListServers(ctx context.Context, input *server.BaseAuthInput) (*ListServersResponse, error) {
	if _, _, err := self.srv.AuthenticatedUser(ctx); err != nil {
		return nil, err
	}

	servers, err := self.srv.ServersService.List(ctx)
	if err != nil {
		log.Error("Error listing servers", "err", err)
		return nil, oapi.MapError(err)
	}

	resp := &ListServersResponse{}
	resp.Body.Data = servers
	return resp, nil
}
