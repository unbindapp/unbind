package oauthserver_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/auth"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/oauthserver"
	oauthserver_repo "github.com/unbindapp/unbind-api/internal/repositories/oauthserver"
)

type CodeExchangeInput struct {
	ClientID     string
	Code         string
	RedirectURI  string
	CodeVerifier string
	Resource     string
}

type RefreshInput struct {
	ClientID     string
	RefreshToken string
}

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	Scope        string `json:"scope,omitempty"`
}

// ExchangeCode turns a consent code into a grant and its first token pair. A
// code presented twice revokes the grant it minted (OAuth 2.1 §4.1.2).
func (self *OAuthServerService) ExchangeCode(ctx context.Context, input *CodeExchangeInput) (*TokenResponse, error) {
	if input.ClientID == "" || input.Code == "" || input.RedirectURI == "" || input.CodeVerifier == "" {
		return nil, oauthserver.InvalidRequest("client_id, code, redirect_uri and code_verifier are required")
	}
	now := self.now()
	code, err := self.repo.OAuthServer().GetCodeByHash(ctx, auth.HashAPIKey(input.Code))
	if ent.IsNotFound(err) {
		return nil, oauthserver.InvalidGrant("unknown authorization code")
	}
	if err != nil {
		return nil, err
	}
	if code.UsedAt != nil {
		if code.GrantID != nil {
			self.revoke(ctx, *code.GrantID)
		}
		return nil, oauthserver.InvalidGrant("authorization code was already used")
	}
	if !code.ExpiresAt.After(now) {
		return nil, oauthserver.InvalidGrant("authorization code has expired")
	}
	if code.ClientID != input.ClientID {
		return nil, oauthserver.InvalidGrant("authorization code was issued to another client")
	}
	if code.RedirectURI != input.RedirectURI {
		return nil, oauthserver.InvalidGrant("redirect_uri does not match the authorization request")
	}
	if !oauthserver.VerifyS256(input.CodeVerifier, code.CodeChallenge) {
		return nil, oauthserver.InvalidGrant("code_verifier does not match")
	}
	if input.Resource != "" && input.Resource != code.Resource {
		return nil, oauthserver.InvalidTarget("resource must be " + code.Resource)
	}

	grant, err := self.repo.OAuthServer().CreateGrant(ctx, &oauthserver_repo.CreateGrantInput{
		UserID:       code.UserID,
		ClientID:     code.ClientID,
		ClientName:   code.ClientName,
		ClientKind:   code.ClientKind,
		ClientURI:    code.ClientURI,
		RedirectURI:  code.RedirectURI,
		Role:         code.Role,
		FullAccess:   code.FullAccess,
		Resources:    code.Resources,
		Capabilities: code.Capabilities,
		Resource:     code.Resource,
		Scope:        code.Scope,
	})
	if err != nil {
		return nil, err
	}
	claimed, err := self.repo.OAuthServer().MarkCodeUsed(ctx, code.ID, now, grant.ID)
	if err != nil {
		return nil, err
	}
	if !claimed {
		self.revoke(ctx, grant.ID)
		return nil, oauthserver.InvalidGrant("authorization code was already used")
	}
	return self.mintTokens(ctx, grant)
}

// Refresh rotates the pair. A refresh token presented after rotation is theft
// or a replay, so the whole grant is revoked.
func (self *OAuthServerService) Refresh(ctx context.Context, input *RefreshInput) (*TokenResponse, error) {
	if input.ClientID == "" || input.RefreshToken == "" {
		return nil, oauthserver.InvalidRequest("client_id and refresh_token are required")
	}
	now := self.now()
	token, err := self.repo.OAuthServer().GetTokenByHash(ctx, auth.HashAPIKey(input.RefreshToken))
	if ent.IsNotFound(err) {
		return nil, oauthserver.InvalidGrant("unknown refresh token")
	}
	if err != nil {
		return nil, err
	}
	grant := token.Edges.Grant
	if token.Kind != schema.OAuthTokenKindRefresh || grant == nil {
		return nil, oauthserver.InvalidGrant("unknown refresh token")
	}
	if token.UsedAt != nil {
		self.revoke(ctx, grant.ID)
		return nil, oauthserver.InvalidGrant("refresh token was already used")
	}
	if grant.RevokedAt != nil {
		return nil, oauthserver.InvalidGrant("access was revoked")
	}
	if !token.ExpiresAt.After(now) {
		return nil, oauthserver.InvalidGrant("refresh token has expired")
	}
	if grant.ClientID != input.ClientID {
		return nil, oauthserver.InvalidGrant("refresh token was issued to another client")
	}
	retired, err := self.repo.OAuthServer().MarkTokenUsed(ctx, token.ID, now)
	if err != nil {
		return nil, err
	}
	if !retired {
		self.revoke(ctx, grant.ID)
		return nil, oauthserver.InvalidGrant("refresh token was already used")
	}
	return self.mintTokens(ctx, grant)
}

func (self *OAuthServerService) mintTokens(ctx context.Context, grant *ent.OAuthGrant) (*TokenResponse, error) {
	access, err := auth.NewOpaqueToken(auth.OAuthAccessTokenPrefix)
	if err != nil {
		return nil, err
	}
	refresh, err := auth.NewOpaqueToken(auth.OAuthRefreshTokenPrefix)
	if err != nil {
		return nil, err
	}
	now := self.now()
	err = self.repo.OAuthServer().CreateTokens(ctx, &oauthserver_repo.CreateTokensInput{
		GrantID:          grant.ID,
		AccessHash:       access.Hash,
		AccessExpiresAt:  now.Add(AccessTokenTTL),
		RefreshHash:      refresh.Hash,
		RefreshExpiresAt: now.Add(RefreshTokenTTL),
	})
	if err != nil {
		return nil, err
	}
	return &TokenResponse{
		AccessToken:  access.Token,
		TokenType:    "Bearer",
		ExpiresIn:    int64(AccessTokenTTL.Seconds()),
		RefreshToken: refresh.Token,
		Scope:        grant.Scope,
	}, nil
}

func (self *OAuthServerService) revoke(ctx context.Context, grantID uuid.UUID) {
	if err := self.repo.OAuthServer().RevokeGrant(ctx, grantID, self.now()); err != nil {
		log.Errorf("oauth: revoke grant %s: %v", grantID, err)
	}
}
