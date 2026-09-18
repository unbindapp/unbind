package oauthserver_handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/api/apictx"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	oauthserver_service "github.com/unbindapp/unbind-api/internal/services/oauthserver"
)

const grantExtraKey = "grant"

// BearerVerifier adapts token verification to the MCP SDK middleware, which
// answers 401 only for errors wrapping auth.ErrInvalidToken.
func (self *Handler) BearerVerifier() auth.TokenVerifier {
	return func(ctx context.Context, token string, _ *http.Request) (*auth.TokenInfo, error) {
		stored, err := self.svc.VerifyAccessToken(ctx, token)
		if errors.Is(err, oauthserver_service.ErrInvalidAccessToken) {
			return nil, fmt.Errorf("%w: %v", auth.ErrInvalidToken, err)
		}
		if err != nil {
			return nil, err
		}
		grant := stored.Edges.Grant
		return &auth.TokenInfo{
			UserID:     grant.UserID.String(),
			Expiration: stored.ExpiresAt,
			Extra:      map[string]any{grantExtraKey: grant},
		}, nil
	}
}

// GrantFromContext returns the grant the SDK middleware verified for /mcp.
func GrantFromContext(ctx context.Context) (*ent.OAuthGrant, bool) {
	info := auth.TokenInfoFromContext(ctx)
	if info == nil {
		return nil, false
	}
	grant, ok := info.Extra[grantExtraKey].(*ent.OAuthGrant)
	return grant, ok
}

// ContextForGrant gives in-process callers the same identity an API key
// request gets: the user, narrowed to the grant, with no Kubernetes identity.
func ContextForGrant(ctx context.Context, grant *ent.OAuthGrant) context.Context {
	ctx = context.WithValue(ctx, apictx.UserKey, grant.Edges.User)
	return permissions_repo.WithAPIKeyAccess(ctx, oauthserver_service.AccessOf(grant))
}

// MCP is a placeholder until the MCP server lands; the bearer middleware in
// front of it already answers the 401 challenge clients discover from.
func (self *Handler) MCP(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "MCP server is not available yet", http.StatusNotImplemented)
}
