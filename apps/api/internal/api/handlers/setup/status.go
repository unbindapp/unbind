package setup_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

type SetupData struct {
	IsBootstrapped     bool `json:"is_bootstrapped"`
	IsFirstUserCreated bool `json:"is_first_user_created"`
}

type SetupStatusResponse struct {
	Body struct {
		Data *SetupData `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) GetStatus(ctx context.Context, input *server.EmptyInput) (*SetupStatusResponse, error) {
	userExists, bootstrapped, err := self.srv.Repository.Bootstrap().IsBootstrapped(ctx, nil)
	if err != nil {
		return nil, oapi.MapError(errdefs.NewInternalError(err, "Failed to check whether Unbind is set up"))
	}

	resp := &SetupStatusResponse{}
	resp.Body.Data = &SetupData{
		IsFirstUserCreated: userExists,
		IsBootstrapped:     bootstrapped,
	}
	return resp, nil
}
