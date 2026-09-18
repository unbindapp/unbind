// Package apictx defines the typed context keys shared between the auth
// middleware (which sets them) and request handlers (which read them).
package apictx

import (
	"context"

	"github.com/unbindapp/unbind-api/ent"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

type contextKey string

const (
	UserKey        contextKey = "user"
	BearerTokenKey contextKey = "bearer_token"
)

type mcpCallerKey struct{}

// MCPCaller is who the MCP server verified at /mcp: the owner of an API key or
// an OAuth grant, with the limit that credential puts on them.
type MCPCaller struct {
	User   *ent.User
	Access permissions_repo.APIKeyAccess
	// Via names the credential for the audit log, never the secret itself.
	Via string
}

// WithMCPCaller marks a request the MCP server dispatches in process as
// already authenticated. Nothing arriving over HTTP can set a context value,
// so the auth middleware trusts it.
func WithMCPCaller(ctx context.Context, caller *MCPCaller) context.Context {
	return context.WithValue(ctx, mcpCallerKey{}, caller)
}

func MCPCallerFromContext(ctx context.Context) (*MCPCaller, bool) {
	caller, ok := ctx.Value(mcpCallerKey{}).(*MCPCaller)
	return caller, ok && caller != nil && caller.User != nil
}
