package logs_handler

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2/sse"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/infrastructure/loki"
	"github.com/unbindapp/unbind-api/internal/models"
)

// LogEvent represents a log line event sent via SSE
type LogEvent struct {
	PodName   string    `json:"podName"`
	Timestamp time.Time `json:"timestamp,omitempty"`
	Message   string    `json:"message"`
}

// Parameters for querying logs
type GetLogInput struct {
	server.BaseAuthInput
	models.LogStreamInput
}

func (self *HandlerGroup) GetLogsfunc(ctx context.Context, input *GetLogInput, send sse.Sender) {
	// Get caller
	user, found := self.srv.GetUserFromContext(ctx)
	bearerToken, _ := self.srv.GetBearerTokenFromContext(ctx)

	if !found {
		log.Error("Error getting user from context")
		_ = send.Data(
			loki.LogEvents{
				MessageType:  loki.LogEventsMessageTypeError,
				ErrorMessage: "unauthorized",
			},
		)
	}

	if err := self.srv.LogService.StreamLogs(ctx, user.ID, bearerToken, &input.LogStreamInput, send); err != nil {
		self.handleSSEErr(err, send)
	}
}
