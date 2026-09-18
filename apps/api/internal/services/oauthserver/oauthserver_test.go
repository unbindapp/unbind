package oauthserver_service

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/auth"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	"github.com/unbindapp/unbind-api/internal/oauthserver"
	oauthserver_repo "github.com/unbindapp/unbind-api/internal/repositories/oauthserver"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/internal/services"
)

const (
	issuer        = "https://unbind.example.com"
	resource      = issuer + "/mcp"
	claudeCode    = "https://claude.ai/oauth/claude-code-client-metadata"
	dynamicID     = "8d1c1c1e-1111-4222-8333-444444444444"
	verifier      = "verifier-verifier-verifier-verifier-verifier-1234"
	loopbackCb    = "http://localhost:3118/callback"
	hostedCb      = "https://claude.ai/api/mcp/auth_callback"
	requestedResp = "code"
)

type stubFetcher map[string]*oauthserver.ClientMetadata

func (f stubFetcher) Fetch(_ context.Context, clientID string) (*oauthserver.ClientMetadata, error) {
	if doc, ok := f[clientID]; ok {
		return doc, nil
	}
	return nil, oauthserver.InvalidClient("client metadata document could not be fetched")
}

type OAuthServerServiceSuite struct {
	services.ServiceTestSuite
	service *OAuthServerService
	user    *ent.User
	now     time.Time
}

func (suite *OAuthServerServiceSuite) SetupTest() {
	suite.ServiceTestSuite.SetupTest()
	suite.user = &ent.User{ID: uuid.New(), Email: "owner@example.com"}
	suite.now = time.Date(2026, 9, 18, 12, 0, 0, 0, time.UTC)
	suite.service = NewOAuthServerService(suite.MockRepo, stubFetcher{claudeCode: {
		ClientID:     claudeCode,
		ClientName:   "Claude Code",
		ClientURI:    "https://claude.ai",
		RedirectURIs: []string{"http://localhost/callback", "http://127.0.0.1/callback"},
	}}, issuer)
	suite.service.now = func() time.Time { return suite.now }
}

func (suite *OAuthServerServiceSuite) dynamicClient() *ent.OAuthClient {
	client := &ent.OAuthClient{ID: uuid.New(), ClientID: dynamicID, Name: "Claude", RedirectUris: []string{hostedCb}}
	suite.MockOAuthServerRepo.EXPECT().GetClientByClientID(mock.Anything, dynamicID).Return(client, nil).Maybe()
	suite.MockOAuthServerRepo.EXPECT().TouchClientLastUsed(mock.Anything, client.ID, suite.now, lastUsedInterval).Return(nil).Maybe()
	return client
}

func challenge() string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func validRequest() *AuthorizeRequest {
	return &AuthorizeRequest{
		ResponseType:        requestedResp,
		ClientID:            claudeCode,
		RedirectURI:         loopbackCb,
		State:               "xyz",
		CodeChallenge:       challenge(),
		CodeChallengeMethod: "S256",
	}
}

func oauthError(err error) *oauthserver.Error {
	var oauthErr *oauthserver.Error
	if errors.As(err, &oauthErr) {
		return oauthErr
	}
	return nil
}

func (suite *OAuthServerServiceSuite) TestValidateAuthorize() {
	suite.dynamicClient()
	suite.MockOAuthServerRepo.EXPECT().GetClientByClientID(mock.Anything, "nope").Return(nil, &ent.NotFoundError{}).Maybe()

	cases := map[string]struct {
		mutate       func(*AuthorizeRequest)
		code         string
		redirectable bool
	}{
		"unknown client":      {func(r *AuthorizeRequest) { r.ClientID = "nope" }, "invalid_client", false},
		"unfetchable doc":     {func(r *AuthorizeRequest) { r.ClientID = "https://other.example/doc.json" }, "invalid_client", false},
		"missing redirect":    {func(r *AuthorizeRequest) { r.RedirectURI = "" }, "invalid_request", false},
		"foreign redirect":    {func(r *AuthorizeRequest) { r.RedirectURI = "http://localhost.evil.com/callback" }, "invalid_request", false},
		"cross loopback host": {func(r *AuthorizeRequest) { r.RedirectURI = "http://[::1]:3118/callback" }, "invalid_request", false},
		"implicit":            {func(r *AuthorizeRequest) { r.ResponseType = "token" }, "unsupported_response_type", true},
		"plain pkce":          {func(r *AuthorizeRequest) { r.CodeChallengeMethod = "plain" }, "invalid_request", true},
		"short challenge":     {func(r *AuthorizeRequest) { r.CodeChallenge = "short" }, "invalid_request", true},
		"long state":          {func(r *AuthorizeRequest) { r.State = strings.Repeat("s", 1025) }, "invalid_request", true},
		"other resource":      {func(r *AuthorizeRequest) { r.Resource = "https://other.example/mcp" }, "invalid_target", true},
	}
	for name, c := range cases {
		req := validRequest()
		c.mutate(req)
		_, err := suite.service.ValidateAuthorize(suite.Ctx, req)
		oauthErr := oauthError(err)
		suite.Require().NotNil(oauthErr, name)
		suite.Equal(c.code, oauthErr.Code, name)
		suite.Equal(c.redirectable, oauthErr.Redirectable, name)
	}

	req := validRequest()
	client, err := suite.service.ValidateAuthorize(suite.Ctx, req)
	suite.Require().NoError(err)
	suite.Equal(schema.OAuthClientKindMetadataDocument, client.Kind)
	suite.Equal(resource, req.Resource, "absent resource defaults to this instance")

	req = validRequest()
	req.ClientID = dynamicID
	req.RedirectURI = hostedCb
	req.Resource = resource
	client, err = suite.service.ValidateAuthorize(suite.Ctx, req)
	suite.Require().NoError(err)
	suite.Equal(schema.OAuthClientKindDynamic, client.Kind)
	suite.MockOAuthServerRepo.AssertCalled(suite.T(), "TouchClientLastUsed", mock.Anything, *client.ID, suite.now, lastUsedInterval)
}

func (suite *OAuthServerServiceSuite) TestClientInfo() {
	info, err := suite.service.ClientInfo(suite.Ctx, &models.ConnectedAppClientInput{ClientID: claudeCode, RedirectURI: loopbackCb})
	suite.Require().NoError(err)
	suite.Equal("Claude Code", info.Name)
	suite.Equal("claude.ai", info.ClientHost)
	suite.Equal("localhost:3118", info.RedirectHost)
	suite.True(info.LoopbackOnly)

	_, err = suite.service.ClientInfo(suite.Ctx, &models.ConnectedAppClientInput{ClientID: claudeCode, RedirectURI: "https://evil.example/cb"})
	suite.Error(err)
}

func (suite *OAuthServerServiceSuite) approveInput() *models.ConnectedAppApproveInput {
	return &models.ConnectedAppApproveInput{
		ClientID:      claudeCode,
		RedirectURI:   loopbackCb,
		State:         "xyz",
		CodeChallenge: challenge(),
		Role:          schema.ActionEditor,
		FullAccess:    true,
		Resources:     []schema.APIKeyResource{},
	}
}

func (suite *OAuthServerServiceSuite) TestApproveStoresHashedCode() {
	var stored oauthserver_repo.CreateCodeInput
	suite.MockOAuthServerRepo.EXPECT().CreateCode(suite.Ctx, mock.Anything).
		RunAndReturn(func(_ context.Context, input *oauthserver_repo.CreateCodeInput) (*ent.OAuthAuthorizationCode, error) {
			stored = *input
			return &ent.OAuthAuthorizationCode{ID: uuid.New()}, nil
		}).Once()

	resp, err := suite.service.Approve(suite.Ctx, suite.user.ID, suite.approveInput())
	suite.Require().NoError(err)

	redirect, err := url.Parse(resp.RedirectURL)
	suite.Require().NoError(err)
	suite.Equal("localhost:3118", redirect.Host)
	suite.Equal("/callback", redirect.Path)
	suite.Equal("xyz", redirect.Query().Get("state"))
	suite.Equal(issuer, redirect.Query().Get("iss"))
	code := redirect.Query().Get("code")
	suite.Len(code, 43)
	suite.Equal(auth.HashAPIKey(code), stored.CodeHash)
	suite.Equal(suite.now.Add(CodeTTL), stored.ExpiresAt)
	suite.Equal(claudeCode, stored.ClientID)
	suite.Equal("Claude Code", stored.ClientName)
	suite.Equal(schema.OAuthClientKindMetadataDocument, stored.ClientKind)
	suite.Equal(loopbackCb, stored.RedirectURI)
	suite.Equal(challenge(), stored.CodeChallenge)
	suite.Equal(resource, stored.Resource)
	suite.Equal(schema.ActionEditor, stored.Role)
	suite.True(stored.FullAccess)
	suite.Equal(suite.user.ID, stored.UserID)
}

func (suite *OAuthServerServiceSuite) TestApproveRejectsAccessTheUserLacks() {
	project := schema.APIKeyResource{ResourceType: schema.ResourceTypeProject, ResourceID: uuid.New()}
	suite.MockPermissionsRepo.EXPECT().
		Check(suite.Ctx, suite.user.ID, []permissions_repo.PermissionCheck{{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeProject, ResourceID: project.ResourceID}}).
		Return(errdefs.ErrUnauthorized).Once()

	input := suite.approveInput()
	input.Role = schema.ActionAdmin
	input.FullAccess = false
	input.Resources = []schema.APIKeyResource{project}
	_, err := suite.service.Approve(suite.Ctx, suite.user.ID, input)
	suite.ErrorIs(err, errdefs.ErrInvalidInput)

	input = suite.approveInput()
	input.Role = "owner"
	_, err = suite.service.Approve(suite.Ctx, suite.user.ID, input)
	suite.ErrorIs(err, errdefs.ErrInvalidInput)

	input = suite.approveInput()
	input.RedirectURI = "https://evil.example/cb"
	_, err = suite.service.Approve(suite.Ctx, suite.user.ID, input)
	suite.ErrorIs(err, errdefs.ErrInvalidInput)
}

func (suite *OAuthServerServiceSuite) TestDeny() {
	resp, err := suite.service.Deny(suite.Ctx, &models.ConnectedAppDenyInput{ClientID: claudeCode, RedirectURI: loopbackCb, State: "xyz"})
	suite.Require().NoError(err)
	redirect, _ := url.Parse(resp.RedirectURL)
	suite.Equal("access_denied", redirect.Query().Get("error"))
	suite.Equal("xyz", redirect.Query().Get("state"))
	suite.Equal(issuer, redirect.Query().Get("iss"))

	_, err = suite.service.Deny(suite.Ctx, &models.ConnectedAppDenyInput{ClientID: claudeCode, RedirectURI: "https://evil.example/cb"})
	suite.ErrorIs(err, errdefs.ErrInvalidInput)
}

func (suite *OAuthServerServiceSuite) storedCode(codeToken string) *ent.OAuthAuthorizationCode {
	return &ent.OAuthAuthorizationCode{
		ID:            uuid.New(),
		CodeHash:      auth.HashAPIKey(codeToken),
		ClientID:      claudeCode,
		ClientName:    "Claude Code",
		ClientKind:    schema.OAuthClientKindMetadataDocument,
		RedirectURI:   loopbackCb,
		CodeChallenge: challenge(),
		Resource:      resource,
		Scope:         "offline_access",
		Role:          schema.ActionViewer,
		FullAccess:    true,
		Resources:     []schema.APIKeyResource{},
		ExpiresAt:     suite.now.Add(30 * time.Second),
		UserID:        suite.user.ID,
		Edges:         ent.OAuthAuthorizationCodeEdges{User: suite.user},
	}
}

func (suite *OAuthServerServiceSuite) expectMint() *oauthserver_repo.CreateTokensInput {
	stored := &oauthserver_repo.CreateTokensInput{}
	suite.MockOAuthServerRepo.EXPECT().CreateTokens(suite.Ctx, mock.Anything).
		RunAndReturn(func(_ context.Context, input *oauthserver_repo.CreateTokensInput) error {
			*stored = *input
			return nil
		}).Once()
	return stored
}

func exchange(code string) *CodeExchangeInput {
	return &CodeExchangeInput{ClientID: claudeCode, Code: code, RedirectURI: loopbackCb, CodeVerifier: verifier}
}

func (suite *OAuthServerServiceSuite) TestExchangeCodeMintsGrantAndTokens() {
	code := suite.storedCode("the-code")
	suite.MockOAuthServerRepo.EXPECT().GetCodeByHash(suite.Ctx, code.CodeHash).Return(code, nil).Once()
	grantID := uuid.New()
	suite.MockOAuthServerRepo.EXPECT().CreateGrant(suite.Ctx, mock.Anything).
		RunAndReturn(func(_ context.Context, input *oauthserver_repo.CreateGrantInput) (*ent.OAuthGrant, error) {
			suite.Equal(suite.user.ID, input.UserID)
			suite.Equal(claudeCode, input.ClientID)
			suite.Equal(schema.ActionViewer, input.Role)
			suite.Equal(resource, input.Resource)
			return &ent.OAuthGrant{ID: grantID, Scope: input.Scope}, nil
		}).Once()
	suite.MockOAuthServerRepo.EXPECT().MarkCodeUsed(suite.Ctx, code.ID, suite.now, grantID).Return(true, nil).Once()
	minted := suite.expectMint()

	resp, err := suite.service.ExchangeCode(suite.Ctx, exchange("the-code"))
	suite.Require().NoError(err)
	suite.Equal("Bearer", resp.TokenType)
	suite.Equal(int64(3600), resp.ExpiresIn)
	suite.Equal("offline_access", resp.Scope)
	suite.True(strings.HasPrefix(resp.AccessToken, auth.OAuthAccessTokenPrefix))
	suite.True(strings.HasPrefix(resp.RefreshToken, auth.OAuthRefreshTokenPrefix))
	suite.Equal(grantID, minted.GrantID)
	suite.Equal(auth.HashAPIKey(resp.AccessToken), minted.AccessHash)
	suite.Equal(auth.HashAPIKey(resp.RefreshToken), minted.RefreshHash)
	suite.Equal(suite.now.Add(AccessTokenTTL), minted.AccessExpiresAt)
	suite.Equal(suite.now.Add(RefreshTokenTTL), minted.RefreshExpiresAt)
}

func (suite *OAuthServerServiceSuite) TestExchangeCodeRejects() {
	usedGrant := uuid.New()
	cases := map[string]struct {
		code   func(*ent.OAuthAuthorizationCode)
		input  func(*CodeExchangeInput)
		want   string
		revoke *uuid.UUID
	}{
		"expired":          {func(c *ent.OAuthAuthorizationCode) { c.ExpiresAt = suite.now }, nil, "invalid_grant", nil},
		"already used":     {func(c *ent.OAuthAuthorizationCode) { c.UsedAt = &suite.now; c.GrantID = &usedGrant }, nil, "invalid_grant", &usedGrant},
		"other client":     {nil, func(i *CodeExchangeInput) { i.ClientID = dynamicID }, "invalid_grant", nil},
		"other redirect":   {nil, func(i *CodeExchangeInput) { i.RedirectURI = "http://localhost:4000/callback" }, "invalid_grant", nil},
		"wrong verifier":   {nil, func(i *CodeExchangeInput) { i.CodeVerifier = strings.Repeat("x", 50) }, "invalid_grant", nil},
		"other resource":   {nil, func(i *CodeExchangeInput) { i.Resource = "https://other.example/mcp" }, "invalid_target", nil},
		"missing verifier": {nil, func(i *CodeExchangeInput) { i.CodeVerifier = "" }, "invalid_request", nil},
	}
	for name, c := range cases {
		code := suite.storedCode(name)
		if c.code != nil {
			c.code(code)
		}
		suite.MockOAuthServerRepo.EXPECT().GetCodeByHash(suite.Ctx, code.CodeHash).Return(code, nil).Maybe()
		if c.revoke != nil {
			suite.MockOAuthServerRepo.EXPECT().RevokeGrant(suite.Ctx, *c.revoke, suite.now).Return(nil).Once()
		}
		input := exchange(name)
		if c.input != nil {
			c.input(input)
		}
		_, err := suite.service.ExchangeCode(suite.Ctx, input)
		oauthErr := oauthError(err)
		suite.Require().NotNil(oauthErr, name)
		suite.Equal(c.want, oauthErr.Code, name)
	}

	suite.MockOAuthServerRepo.EXPECT().GetCodeByHash(suite.Ctx, auth.HashAPIKey("unknown")).Return(nil, &ent.NotFoundError{}).Once()
	_, err := suite.service.ExchangeCode(suite.Ctx, exchange("unknown"))
	suite.Equal("invalid_grant", oauthError(err).Code)
}

func (suite *OAuthServerServiceSuite) TestExchangeCodeLosingTheClaimRevokesItsGrant() {
	code := suite.storedCode("raced")
	grantID := uuid.New()
	suite.MockOAuthServerRepo.EXPECT().GetCodeByHash(suite.Ctx, code.CodeHash).Return(code, nil).Once()
	suite.MockOAuthServerRepo.EXPECT().CreateGrant(suite.Ctx, mock.Anything).Return(&ent.OAuthGrant{ID: grantID}, nil).Once()
	suite.MockOAuthServerRepo.EXPECT().MarkCodeUsed(suite.Ctx, code.ID, suite.now, grantID).Return(false, nil).Once()
	suite.MockOAuthServerRepo.EXPECT().RevokeGrant(suite.Ctx, grantID, suite.now).Return(nil).Once()

	_, err := suite.service.ExchangeCode(suite.Ctx, exchange("raced"))
	suite.Equal("invalid_grant", oauthError(err).Code)
}

func (suite *OAuthServerServiceSuite) grantWithUser() *ent.OAuthGrant {
	return &ent.OAuthGrant{
		ID: uuid.New(), UserID: suite.user.ID, ClientID: claudeCode, ClientKind: schema.OAuthClientKindMetadataDocument,
		Role: schema.ActionEditor, FullAccess: true, Resources: []schema.APIKeyResource{}, Resource: resource,
		Edges: ent.OAuthGrantEdges{User: suite.user},
	}
}

func (suite *OAuthServerServiceSuite) storedToken(raw string, kind schema.OAuthTokenKind, grant *ent.OAuthGrant) *ent.OAuthGrantToken {
	return &ent.OAuthGrantToken{
		ID: uuid.New(), Kind: kind, TokenHash: auth.HashAPIKey(raw), ExpiresAt: suite.now.Add(time.Hour),
		GrantID: grant.ID, Edges: ent.OAuthGrantTokenEdges{Grant: grant},
	}
}

func (suite *OAuthServerServiceSuite) TestRefreshRotates() {
	grant := suite.grantWithUser()
	old := suite.storedToken("unbrt_old", schema.OAuthTokenKindRefresh, grant)
	suite.MockOAuthServerRepo.EXPECT().GetTokenByHash(suite.Ctx, old.TokenHash).Return(old, nil).Once()
	suite.MockOAuthServerRepo.EXPECT().MarkTokenUsed(suite.Ctx, old.ID, suite.now).Return(true, nil).Once()
	minted := suite.expectMint()

	resp, err := suite.service.Refresh(suite.Ctx, &RefreshInput{ClientID: claudeCode, RefreshToken: "unbrt_old"})
	suite.Require().NoError(err)
	suite.NotEqual("unbrt_old", resp.RefreshToken)
	suite.Equal(grant.ID, minted.GrantID)
	suite.Equal(auth.HashAPIKey(resp.RefreshToken), minted.RefreshHash)
}

func (suite *OAuthServerServiceSuite) TestRefreshRejects() {
	grant := suite.grantWithUser()
	revokedGrant := suite.grantWithUser()
	revokedGrant.RevokedAt = &suite.now
	otherClientGrant := suite.grantWithUser()
	otherClientGrant.ClientID = dynamicID

	cases := map[string]struct {
		token  func(*ent.OAuthGrantToken)
		revoke bool
	}{
		"reused":        {func(t *ent.OAuthGrantToken) { t.UsedAt = &suite.now }, true},
		"expired":       {func(t *ent.OAuthGrantToken) { t.ExpiresAt = suite.now }, false},
		"revoked grant": {func(t *ent.OAuthGrantToken) { t.Edges.Grant = revokedGrant }, false},
		"other client":  {func(t *ent.OAuthGrantToken) { t.Edges.Grant = otherClientGrant }, false},
		"access token":  {func(t *ent.OAuthGrantToken) { t.Kind = schema.OAuthTokenKindAccess }, false},
	}
	for name, c := range cases {
		token := suite.storedToken("unbrt_"+name, schema.OAuthTokenKindRefresh, grant)
		c.token(token)
		suite.MockOAuthServerRepo.EXPECT().GetTokenByHash(suite.Ctx, token.TokenHash).Return(token, nil).Once()
		if c.revoke {
			suite.MockOAuthServerRepo.EXPECT().RevokeGrant(suite.Ctx, grant.ID, suite.now).Return(nil).Once()
		}
		_, err := suite.service.Refresh(suite.Ctx, &RefreshInput{ClientID: claudeCode, RefreshToken: "unbrt_" + name})
		oauthErr := oauthError(err)
		suite.Require().NotNil(oauthErr, name)
		suite.Equal("invalid_grant", oauthErr.Code, name)
	}
}

func (suite *OAuthServerServiceSuite) TestVerifyAccessToken() {
	grant := suite.grantWithUser()
	live := suite.storedToken("unbat_live", schema.OAuthTokenKindAccess, grant)
	suite.MockOAuthServerRepo.EXPECT().GetTokenByHash(suite.Ctx, live.TokenHash).Return(live, nil).Once()
	suite.MockOAuthServerRepo.EXPECT().TouchGrantLastUsed(suite.Ctx, grant.ID, suite.now, lastUsedInterval).Return(nil).Once()

	verified, err := suite.service.VerifyAccessToken(suite.Ctx, "unbat_live")
	suite.Require().NoError(err)
	suite.Equal(grant.ID, verified.Edges.Grant.ID)
	suite.Equal(suite.user.ID, verified.Edges.Grant.Edges.User.ID)
	access := AccessOf(verified.Edges.Grant)
	suite.Equal(schema.ActionEditor, access.Role)
	suite.True(access.FullAccess)

	revoked := suite.grantWithUser()
	revoked.RevokedAt = &suite.now
	foreign := suite.grantWithUser()
	foreign.Resource = "https://other.example/mcp"
	cases := map[string]func(*ent.OAuthGrantToken){
		"expired":        func(t *ent.OAuthGrantToken) { t.ExpiresAt = suite.now },
		"revoked":        func(t *ent.OAuthGrantToken) { t.Edges.Grant = revoked },
		"other resource": func(t *ent.OAuthGrantToken) { t.Edges.Grant = foreign },
		"refresh kind":   func(t *ent.OAuthGrantToken) { t.Kind = schema.OAuthTokenKindRefresh },
	}
	for name, mutate := range cases {
		token := suite.storedToken("unbat_"+name, schema.OAuthTokenKindAccess, grant)
		mutate(token)
		suite.MockOAuthServerRepo.EXPECT().GetTokenByHash(suite.Ctx, token.TokenHash).Return(token, nil).Once()
		_, err := suite.service.VerifyAccessToken(suite.Ctx, "unbat_"+name)
		suite.ErrorIs(err, ErrInvalidAccessToken, name)
	}

	suite.MockOAuthServerRepo.EXPECT().GetTokenByHash(suite.Ctx, auth.HashAPIKey("unbat_unknown")).Return(nil, &ent.NotFoundError{}).Once()
	_, err = suite.service.VerifyAccessToken(suite.Ctx, "unbat_unknown")
	suite.ErrorIs(err, ErrInvalidAccessToken)

	_, err = suite.service.VerifyAccessToken(suite.Ctx, "unb_apikey")
	suite.ErrorIs(err, ErrInvalidAccessToken)
	_, err = suite.service.VerifyAccessToken(suite.Ctx, "unbrt_refresh")
	suite.ErrorIs(err, ErrInvalidAccessToken)
}

func (suite *OAuthServerServiceSuite) TestRevokeGrantOwnerOnly() {
	own := suite.grantWithUser()
	theirs := suite.grantWithUser()
	theirs.UserID = uuid.New()
	suite.MockOAuthServerRepo.EXPECT().GetGrantByID(suite.Ctx, own.ID).Return(own, nil).Once()
	suite.MockOAuthServerRepo.EXPECT().GetGrantByID(suite.Ctx, theirs.ID).Return(theirs, nil).Once()
	suite.MockOAuthServerRepo.EXPECT().GetGrantByID(suite.Ctx, mock.Anything).Return(nil, &ent.NotFoundError{}).Once()
	suite.MockOAuthServerRepo.EXPECT().RevokeGrant(suite.Ctx, own.ID, suite.now).Return(nil).Once()

	suite.NoError(suite.service.RevokeGrant(suite.Ctx, suite.user.ID, own.ID))
	suite.ErrorIs(suite.service.RevokeGrant(suite.Ctx, suite.user.ID, theirs.ID), errdefs.ErrNotFound)
	suite.ErrorIs(suite.service.RevokeGrant(suite.Ctx, suite.user.ID, uuid.New()), errdefs.ErrNotFound)
}

func (suite *OAuthServerServiceSuite) TestListGrants() {
	grant := suite.grantWithUser()
	grant.RedirectURI = hostedCb
	suite.MockOAuthServerRepo.EXPECT().ListGrantsByUser(suite.Ctx, suite.user.ID).Return([]*ent.OAuthGrant{grant}, nil).Once()

	apps, err := suite.service.ListGrants(suite.Ctx, suite.user.ID)
	suite.Require().NoError(err)
	suite.Require().Len(apps, 1)
	suite.Equal(grant.ID, apps[0].ID)
	suite.Equal("claude.ai", apps[0].RedirectHost)
	suite.Equal("claude.ai", apps[0].ClientHost)
	suite.Empty(apps[0].Resources)
}

func TestOAuthServerServiceSuite(t *testing.T) {
	suite.Run(t, new(OAuthServerServiceSuite))
}
