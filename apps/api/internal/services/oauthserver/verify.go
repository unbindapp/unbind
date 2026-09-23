package oauthserver_service

import (
	"context"
	"strings"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/auth"
	"github.com/unbindapp/unbind-api/internal/common/log"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// VerifyAccessToken resolves a bearer token presented to /mcp, returning it with
// its grant and user loaded. Every failure is ErrInvalidAccessToken so callers
// answer 401 without leaking which check failed.
func (self *OAuthServerService) VerifyAccessToken(ctx context.Context, token string) (*ent.OAuthGrantToken, error) {
	if !strings.HasPrefix(token, auth.OAuthAccessTokenPrefix) {
		return nil, ErrInvalidAccessToken
	}
	now := self.now()
	stored, err := self.repo.OAuthServer().GetTokenByHash(ctx, auth.HashAPIKey(token))
	if ent.IsNotFound(err) {
		return nil, ErrInvalidAccessToken
	}
	if err != nil {
		return nil, err
	}
	grant := stored.Edges.Grant
	if stored.Kind != schema.OAuthTokenKindAccess || grant == nil || grant.Edges.User == nil {
		return nil, ErrInvalidAccessToken
	}
	if !stored.ExpiresAt.After(now) || grant.RevokedAt != nil || grant.Resource != self.resource {
		return nil, ErrInvalidAccessToken
	}
	if err := self.repo.OAuthServer().TouchGrantLastUsed(ctx, grant.ID, now, lastUsedInterval); err != nil {
		log.Warnf("oauth: record grant use: %v", err)
	}
	return stored, nil
}

// AccessOf is the narrowing an OAuth grant applies, identical to an API key's.
func AccessOf(grant *ent.OAuthGrant) permissions_repo.APIKeyAccess {
	return permissions_repo.APIKeyAccess{Role: grant.Role, FullAccess: grant.FullAccess, Resources: grant.Resources, Privileges: grant.Privileges}
}
