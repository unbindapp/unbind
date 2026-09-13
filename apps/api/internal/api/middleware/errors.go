package middleware

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

// ErrorTransformer runs on every response huma writes. On error bodies it stamps
// the request id the caller can quote, and logs the failures that are ours with
// the cause and the request context, so a red banner in the UI can always be
// traced to one log line.
func ErrorTransformer(ctx huma.Context, _ string, v any) (any, error) {
	resp, ok := v.(*errdefs.ResponseError)
	if !ok {
		return v, nil
	}

	resp.RequestID = GetReqID(ctx.Context())

	if resp.Status < http.StatusInternalServerError {
		return resp, nil
	}

	keyvals := []any{
		"request_id", resp.RequestID,
		"method", ctx.Method(),
		"path", ctx.URL().Path,
		"status", resp.Status,
	}
	if cause := resp.Cause(); cause != nil {
		keyvals = append(keyvals, "err", cause)
	}
	log.Error(resp.Message, keyvals...)

	return resp, nil
}
