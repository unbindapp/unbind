package logs_handler

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/infrastructure/loki"
	"github.com/unbindapp/unbind-api/internal/models"
)

type QueryLogsInput struct {
	server.BaseAuthInput
	models.LogQueryInput
}

type QueryLogsResponse struct {
	Body struct {
		Data []loki.LogEvent `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) QueryLogs(ctx context.Context, input *QueryLogsInput) (*QueryLogsResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	logs, err := self.srv.LogService.QueryLogs(ctx, user.ID, &input.LogQueryInput)
	if err != nil {
		return nil, oapi.MapError(err)
	}

	resp := &QueryLogsResponse{}
	resp.Body.Data = logs
	return resp, nil
}
