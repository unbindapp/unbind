package mcpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/unbindapp/unbind-api/internal/api/apictx"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

type dispatcher struct {
	router http.Handler
}

// handlerFor runs a tool call as a request to the tool's API operation. The
// request carries the verified caller instead of a credential, which the auth
// middleware treats like an API key with the same access.
func (self *dispatcher) handlerFor(t *tool) mcp.ToolHandler {
	return func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		caller, ok := callerOf(req.Extra.TokenInfo)
		if !ok {
			return nil, fmt.Errorf("mcp: tool call without a verified caller")
		}

		// The call arrived through the router at /mcp, so routing state from
		// that request must not leak into this one.
		ctx = context.WithValue(ctx, chi.RouteCtxKey, chi.NewRouteContext())
		httpReq, err := t.request(apictx.WithMCPCaller(ctx, caller), req.Params.Arguments)
		if err != nil {
			return errorResult(err.Error()), nil
		}

		rec := &responseRecorder{header: http.Header{}, status: http.StatusOK}
		self.router.ServeHTTP(rec, httpReq)

		log.Infof("mcp: tool=%s user=%s via=%q status=%d", t.definition.Name, caller.User.ID, caller.Via, rec.status)

		text := strings.TrimSpace(rec.body.String())
		if text == "" {
			text = http.StatusText(rec.status)
		}
		return &mcp.CallToolResult{
			Content: []mcp.Content{&mcp.TextContent{Text: text}},
			IsError: rec.status >= http.StatusBadRequest,
		}, nil
	}
}

func (self *tool) request(ctx context.Context, arguments json.RawMessage) (*http.Request, error) {
	if len(bytes.TrimSpace(arguments)) == 0 {
		arguments = json.RawMessage("{}")
	}

	if self.hasBody {
		req, err := http.NewRequestWithContext(ctx, self.method, self.path, bytes.NewReader(arguments))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", jsonContentType)
		return req, nil
	}

	query, err := self.query(arguments)
	if err != nil {
		return nil, err
	}
	target := self.path
	if encoded := query.Encode(); encoded != "" {
		target += "?" + encoded
	}
	return http.NewRequestWithContext(ctx, self.method, target, nil)
}

func (self *tool) query(arguments json.RawMessage) (url.Values, error) {
	decoder := json.NewDecoder(bytes.NewReader(arguments))
	decoder.UseNumber()
	var values map[string]any
	if err := decoder.Decode(&values); err != nil {
		return nil, fmt.Errorf("arguments must be a JSON object")
	}

	query := url.Values{}
	for name, value := range values {
		param, known := self.queryParams[name]
		if !known {
			return nil, fmt.Errorf("unknown argument %q", name)
		}
		if value == nil {
			continue
		}
		items, isList := value.([]any)
		if !isList {
			query.Set(name, fmt.Sprint(value))
			continue
		}
		parts := make([]string, len(items))
		for i, item := range items {
			parts[i] = fmt.Sprint(item)
		}
		if param.Explode != nil && *param.Explode {
			query[name] = parts
			continue
		}
		query.Set(name, strings.Join(parts, ","))
	}
	return query, nil
}

func errorResult(message string) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		Content: []mcp.Content{&mcp.TextContent{Text: message}},
		IsError: true,
	}
}

type responseRecorder struct {
	header http.Header
	body   bytes.Buffer
	status int
}

func (self *responseRecorder) Header() http.Header { return self.header }

func (self *responseRecorder) WriteHeader(status int) { self.status = status }

func (self *responseRecorder) Write(p []byte) (int, error) { return self.body.Write(p) }
