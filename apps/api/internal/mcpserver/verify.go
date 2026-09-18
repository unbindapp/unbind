package mcpserver

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/api/apictx"
	unbind_auth "github.com/unbindapp/unbind-api/internal/auth"
	"github.com/unbindapp/unbind-api/internal/common/log"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	oauthserver_service "github.com/unbindapp/unbind-api/internal/services/oauthserver"
)

const (
	callerExtraKey         = "caller"
	apiKeyLastUsedInterval = time.Minute
)

type AccessTokenVerifier interface {
	VerifyAccessToken(ctx context.Context, token string) (*ent.OAuthGrantToken, error)
}

type APIKeyStore interface {
	unbind_auth.APIKeyLookup
	TouchLastUsed(ctx context.Context, id uuid.UUID, now time.Time, minInterval time.Duration) error
}

// newVerifier accepts OAuth access tokens and API keys. The SDK middleware
// answers 401 only for errors wrapping auth.ErrInvalidToken.
func newVerifier(oauth AccessTokenVerifier, keys APIKeyStore, now func() time.Time) auth.TokenVerifier {
	return func(ctx context.Context, token string, _ *http.Request) (*auth.TokenInfo, error) {
		if unbind_auth.IsAPIKey(token) {
			return verifyAPIKey(ctx, keys, token, now())
		}

		stored, err := oauth.VerifyAccessToken(ctx, token)
		if errors.Is(err, oauthserver_service.ErrInvalidAccessToken) {
			return nil, fmt.Errorf("%w: %v", auth.ErrInvalidToken, err)
		}
		if err != nil {
			return nil, err
		}
		grant := stored.Edges.Grant
		return tokenInfo(&apictx.MCPCaller{
			User:   grant.Edges.User,
			Access: oauthserver_service.AccessOf(grant),
			Via:    "grant " + grant.ID.String(),
		}, stored.ExpiresAt), nil
	}
}

func verifyAPIKey(ctx context.Context, keys APIKeyStore, token string, now time.Time) (*auth.TokenInfo, error) {
	key, ok := unbind_auth.VerifyAPIKey(ctx, keys, token, now)
	if !ok {
		return nil, fmt.Errorf("%w: invalid or expired api key", auth.ErrInvalidToken)
	}
	if err := keys.TouchLastUsed(ctx, key.ID, now, apiKeyLastUsedInterval); err != nil {
		log.Warnf("mcp: record api key use: %v", err)
	}

	info := tokenInfo(&apictx.MCPCaller{
		User:   key.Edges.User,
		Access: permissions_repo.APIKeyAccessOf(key),
		Via:    "api key " + key.ID.String(),
	}, time.Time{})
	if key.ExpiresAt != nil {
		info.Expiration = *key.ExpiresAt
	}
	return info, nil
}

func tokenInfo(caller *apictx.MCPCaller, expiration time.Time) *auth.TokenInfo {
	return &auth.TokenInfo{
		UserID:     caller.User.ID.String(),
		Expiration: expiration,
		Extra:      map[string]any{callerExtraKey: caller},
	}
}

func callerOf(info *auth.TokenInfo) (*apictx.MCPCaller, bool) {
	if info == nil {
		return nil, false
	}
	caller, ok := info.Extra[callerExtraKey].(*apictx.MCPCaller)
	return caller, ok && caller != nil
}
