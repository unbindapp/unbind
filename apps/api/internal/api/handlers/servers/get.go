package servers_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
)

type GetServerInput struct {
	server.BaseAuthInput
	Name string `query:"name" required:"true" doc:"The name of the server"`
}

type GetServerResponse struct {
	Body struct {
		Data *models.ServerDetailResponse `json:"data"`
	}
}

func (self *HandlerGroup) GetServer(ctx context.Context, input *GetServerInput) (*GetServerResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	serverDetail, err := self.srv.ServersService.Get(ctx, user.ID, input.Name)
	if err != nil {
		log.Error("Error getting server", "err", err)
		return nil, oapi.MapError(err)
	}

	resp := &GetServerResponse{}
	resp.Body.Data = serverDetail
	return resp, nil
}
