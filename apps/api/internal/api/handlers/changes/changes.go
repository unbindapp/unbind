package changes_handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/models"
)

type HandlerGroup struct {
	srv *server.Server
}

func RegisterHandlers(server *server.Server, grp *huma.Group) {
	handlers := &HandlerGroup{
		srv: server,
	}

	oapi.Register(grp, oapi.Invoke, huma.Operation{
		OperationID: "apply-changes",
		Summary:     "Apply Changes",
		Description: "Apply staged variable and service config changes together, rolling out each affected service once. Use dry_run to preview which services would be affected.",
		Path:        "/apply",
		Method:      http.MethodPost,
	}, handlers.ApplyChanges)
}

type ApplyChangesInput struct {
	server.BaseAuthInput
	Body models.ApplyChangesInput
}

type ApplyChangesResponse struct {
	Body struct {
		Data *models.ApplyChangesResponse `json:"data"`
	}
}

func (self *HandlerGroup) ApplyChanges(ctx context.Context, input *ApplyChangesInput) (*ApplyChangesResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	result, err := self.srv.ServiceService.ApplyChanges(ctx, user.ID, &input.Body)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &ApplyChangesResponse{}
	resp.Body.Data = result
	return resp, nil
}
