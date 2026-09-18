package oauthserver_handler

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/middleware"
	"github.com/unbindapp/unbind-api/internal/mcpserver"
	"github.com/unbindapp/unbind-api/internal/models"
	"github.com/unbindapp/unbind-api/internal/oauthserver"
	"github.com/unbindapp/unbind-api/internal/repositories/repositories"
	repository "github.com/unbindapp/unbind-api/internal/repositories/repositorytest"
	oauthserver_service "github.com/unbindapp/unbind-api/internal/services/oauthserver"
)

const (
	issuer     = "https://unbind.example.com"
	claudeCode = "https://claude.ai/oauth/claude-code-client-metadata"
	verifier   = "verifier-verifier-verifier-verifier-verifier-1234"
	callback   = "http://localhost:3118/callback"
)

type stubFetcher struct{}

func (stubFetcher) Fetch(_ context.Context, clientID string) (*oauthserver.ClientMetadata, error) {
	if clientID != claudeCode {
		return nil, oauthserver.InvalidClient("client metadata document could not be fetched")
	}
	return &oauthserver.ClientMetadata{
		ClientID:     claudeCode,
		ClientName:   "Claude Code",
		RedirectURIs: []string{"http://localhost/callback", "http://127.0.0.1/callback"},
	}, nil
}

type HandlerSuite struct {
	repository.RepositoryBaseSuite
	router  *chi.Mux
	service *oauthserver_service.OAuthServerService
	user    *ent.User
}

func (suite *HandlerSuite) SetupTest() {
	suite.RepositoryBaseSuite.SetupTest()
	suite.user = suite.DB.User.Create().SetEmail("owner@example.com").SetPasswordHash("x").SaveX(suite.Ctx)
	suite.service = oauthserver_service.NewOAuthServerService(repositories.NewRepositories(suite.DB), stubFetcher{}, issuer)
	mr := miniredis.RunT(suite.T())
	limiter := middleware.NewRateLimiter(redis.NewClient(&redis.Options{Addr: mr.Addr()}))
	suite.router = chi.NewRouter()
	NewHandler(suite.service).Mount(suite.router, limiter)

	repo := repositories.NewRepositories(suite.DB)
	mcpServer, err := mcpserver.New(mcpserver.Options{
		API:     humachi.New(chi.NewRouter(), huma.DefaultConfig("test", "1")),
		Router:  suite.router,
		OAuth:   suite.service,
		APIKeys: repo.APIKey(),
		Issuer:  issuer,
	})
	suite.Require().NoError(err)
	mcpServer.Mount(suite.router, limiter)
}

func (suite *HandlerSuite) do(req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	suite.router.ServeHTTP(rec, req)
	return rec
}

func (suite *HandlerSuite) get(path string) *httptest.ResponseRecorder {
	return suite.do(httptest.NewRequest(http.MethodGet, path, nil))
}

func (suite *HandlerSuite) postForm(path string, form url.Values) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	return suite.do(req)
}

func (suite *HandlerSuite) postJSON(path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return suite.do(req)
}

func (suite *HandlerSuite) decode(rec *httptest.ResponseRecorder) map[string]any {
	var body map[string]any
	suite.Require().NoError(json.Unmarshal(rec.Body.Bytes(), &body), rec.Body.String())
	return body
}

func challenge() string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func authorizeQuery(clientID, redirectURI string) url.Values {
	return url.Values{
		"response_type":         {"code"},
		"client_id":             {clientID},
		"redirect_uri":          {redirectURI},
		"state":                 {"xyz"},
		"code_challenge":        {challenge()},
		"code_challenge_method": {"S256"},
		"resource":              {issuer + "/mcp"},
	}
}

func (suite *HandlerSuite) approve(clientID, redirectURI string) string {
	resp, err := suite.service.Approve(suite.Ctx, suite.user.ID, &models.ConnectedAppApproveInput{
		ClientID:      clientID,
		RedirectURI:   redirectURI,
		State:         "xyz",
		CodeChallenge: challenge(),
		Role:          schema.ActionViewer,
		FullAccess:    true,
		Resources:     []schema.APIKeyResource{},
	})
	suite.Require().NoError(err)
	redirect, err := url.Parse(resp.RedirectURL)
	suite.Require().NoError(err)
	return redirect.Query().Get("code")
}

func (suite *HandlerSuite) TestMetadataDocuments() {
	rec := suite.get("/.well-known/oauth-authorization-server")
	suite.Equal(http.StatusOK, rec.Code)
	doc := suite.decode(rec)
	suite.Equal(issuer, doc["issuer"])
	suite.Equal(issuer+"/oauth/token", doc["token_endpoint"])
	suite.Equal([]any{"S256"}, doc["code_challenge_methods_supported"])

	rec = suite.get("/.well-known/oauth-protected-resource")
	suite.Equal(http.StatusOK, rec.Code)
	doc = suite.decode(rec)
	suite.Equal(issuer+"/mcp", doc["resource"])
	suite.Equal([]any{issuer}, doc["authorization_servers"])
}

func (suite *HandlerSuite) TestMCPChallengesWithoutToken() {
	rec := suite.get("/mcp")
	suite.Equal(http.StatusUnauthorized, rec.Code)
	suite.Contains(rec.Header().Get("WWW-Authenticate"), `resource_metadata="`+issuer+`/.well-known/oauth-protected-resource"`)

	req := httptest.NewRequest(http.MethodGet, "/mcp", nil)
	req.Header.Set("Authorization", "Bearer unbat_nope")
	suite.Equal(http.StatusUnauthorized, suite.do(req).Code)
}

func (suite *HandlerSuite) TestRegister() {
	rec := suite.postJSON("/oauth/register", `{"client_name":"Cursor","redirect_uris":["http://127.0.0.1/callback"],"application_type":"native"}`)
	suite.Equal(http.StatusCreated, rec.Code, rec.Body.String())
	body := suite.decode(rec)
	suite.NotEmpty(body["client_id"])
	suite.Equal("none", body["token_endpoint_auth_method"])
	suite.Equal("no-store", rec.Header().Get("Cache-Control"))

	rec = suite.postJSON("/oauth/register", `{"client_name":"Bad","redirect_uris":["http://evil.example/cb"]}`)
	suite.Equal(http.StatusBadRequest, rec.Code)
	suite.Equal("invalid_redirect_uri", suite.decode(rec)["error"])

	rec = suite.postJSON("/oauth/register", `{"client_name":"`+strings.Repeat("x", 9000)+`"}`)
	suite.Equal(http.StatusBadRequest, rec.Code)
	suite.Equal("invalid_client_metadata", suite.decode(rec)["error"])
}

func (suite *HandlerSuite) TestRegisterIsRateLimited() {
	for i := 0; i < 10; i++ {
		suite.Equal(http.StatusCreated, suite.postJSON("/oauth/register", `{"client_name":"C","redirect_uris":["https://a.com/cb"]}`).Code)
	}
	rec := suite.postJSON("/oauth/register", `{"client_name":"C","redirect_uris":["https://a.com/cb"]}`)
	suite.Equal(http.StatusTooManyRequests, rec.Code)
	suite.NotEmpty(rec.Header().Get("Retry-After"))
}

func (suite *HandlerSuite) TestAuthorizeRedirects() {
	rec := suite.get("/oauth/authorize?" + authorizeQuery(claudeCode, callback).Encode())
	suite.Equal(http.StatusFound, rec.Code, rec.Body.String())
	location, err := url.Parse(rec.Header().Get("Location"))
	suite.Require().NoError(err)
	suite.Equal(issuer+"/oauth/consent", location.Scheme+"://"+location.Host+location.Path)
	suite.Equal(claudeCode, location.Query().Get("client_id"))
	suite.Equal(callback, location.Query().Get("redirect_uri"))
	suite.Equal("xyz", location.Query().Get("state"))
	suite.Equal(issuer+"/mcp", location.Query().Get("resource"))

	bad := authorizeQuery(claudeCode, callback)
	bad.Set("code_challenge_method", "plain")
	rec = suite.get("/oauth/authorize?" + bad.Encode())
	suite.Equal(http.StatusFound, rec.Code)
	location, _ = url.Parse(rec.Header().Get("Location"))
	suite.Equal("localhost:3118", location.Host)
	suite.Equal("invalid_request", location.Query().Get("error"))
	suite.Equal("xyz", location.Query().Get("state"))
	suite.Equal(issuer, location.Query().Get("iss"))

	rec = suite.get("/oauth/authorize?" + authorizeQuery("unknown", callback).Encode())
	suite.Equal(http.StatusBadRequest, rec.Code)
	suite.Equal("invalid_client", suite.decode(rec)["error"])

	rec = suite.get("/oauth/authorize?" + authorizeQuery(claudeCode, "https://evil.example/cb").Encode())
	suite.Equal(http.StatusBadRequest, rec.Code)
	suite.Equal("invalid_request", suite.decode(rec)["error"])
}

func (suite *HandlerSuite) TestCodeExchangeRefreshAndRevocation() {
	code := suite.approve(claudeCode, callback)

	rec := suite.postForm("/oauth/token", url.Values{
		"grant_type": {"authorization_code"}, "client_id": {claudeCode}, "code": {code},
		"redirect_uri": {callback}, "code_verifier": {verifier}, "resource": {issuer + "/mcp"},
	})
	suite.Equal(http.StatusOK, rec.Code, rec.Body.String())
	suite.Equal("no-store", rec.Header().Get("Cache-Control"))
	tokens := suite.decode(rec)
	access := tokens["access_token"].(string)
	refresh := tokens["refresh_token"].(string)
	suite.Equal("Bearer", tokens["token_type"])
	suite.Equal(float64(3600), tokens["expires_in"])

	req := httptest.NewRequest(http.MethodGet, "/mcp", nil)
	req.Header.Set("Authorization", "Bearer "+access)
	suite.NotEqual(http.StatusUnauthorized, suite.do(req).Code, "a fresh access token is accepted at /mcp")

	rec = suite.postForm("/oauth/token", url.Values{
		"grant_type": {"authorization_code"}, "client_id": {claudeCode}, "code": {code},
		"redirect_uri": {callback}, "code_verifier": {verifier},
	})
	suite.Equal(http.StatusBadRequest, rec.Code)
	suite.Equal("invalid_grant", suite.decode(rec)["error"])
	suite.Equal(http.StatusUnauthorized, suite.do(req).Code, "a replayed code revokes the grant it minted")

	code = suite.approve(claudeCode, callback)
	rec = suite.postForm("/oauth/token", url.Values{
		"grant_type": {"authorization_code"}, "client_id": {claudeCode}, "code": {code},
		"redirect_uri": {callback}, "code_verifier": {verifier},
	})
	suite.Require().Equal(http.StatusOK, rec.Code, rec.Body.String())
	refresh = suite.decode(rec)["refresh_token"].(string)

	rec = suite.postForm("/oauth/token", url.Values{"grant_type": {"refresh_token"}, "client_id": {claudeCode}, "refresh_token": {refresh}})
	suite.Equal(http.StatusOK, rec.Code, rec.Body.String())
	rotated := suite.decode(rec)
	suite.NotEqual(refresh, rotated["refresh_token"])
	newAccess := rotated["access_token"].(string)

	rec = suite.postForm("/oauth/token", url.Values{"grant_type": {"refresh_token"}, "client_id": {claudeCode}, "refresh_token": {refresh}})
	suite.Equal(http.StatusBadRequest, rec.Code)
	suite.Equal("invalid_grant", suite.decode(rec)["error"])

	req.Header.Set("Authorization", "Bearer "+newAccess)
	suite.Equal(http.StatusUnauthorized, suite.do(req).Code, "refresh reuse revokes the grant")

	grants, err := suite.service.ListGrants(suite.Ctx, suite.user.ID)
	suite.NoError(err)
	suite.Empty(grants)
}

func (suite *HandlerSuite) TestTokenEndpointErrors() {
	rec := suite.postForm("/oauth/token", url.Values{"grant_type": {"client_credentials"}})
	suite.Equal(http.StatusBadRequest, rec.Code)
	suite.Equal("unsupported_grant_type", suite.decode(rec)["error"])

	rec = suite.postForm("/oauth/token", url.Values{"grant_type": {"authorization_code"}})
	suite.Equal(http.StatusBadRequest, rec.Code)
	suite.Equal("invalid_request", suite.decode(rec)["error"])

	code := suite.approve(claudeCode, callback)
	rec = suite.postForm("/oauth/token", url.Values{
		"grant_type": {"authorization_code"}, "client_id": {claudeCode}, "code": {code},
		"redirect_uri": {callback}, "code_verifier": {verifier}, "resource": {"https://other.example/mcp"},
	})
	suite.Equal(http.StatusBadRequest, rec.Code)
	suite.Equal("invalid_target", suite.decode(rec)["error"])
}

func (suite *HandlerSuite) TestRevokedGrantStopsAccess() {
	code := suite.approve(claudeCode, callback)
	rec := suite.postForm("/oauth/token", url.Values{
		"grant_type": {"authorization_code"}, "client_id": {claudeCode}, "code": {code},
		"redirect_uri": {callback}, "code_verifier": {verifier},
	})
	suite.Require().Equal(http.StatusOK, rec.Code)
	access := suite.decode(rec)["access_token"].(string)

	grants, err := suite.service.ListGrants(suite.Ctx, suite.user.ID)
	suite.Require().NoError(err)
	suite.Require().Len(grants, 1)
	suite.Equal("Claude Code", grants[0].ClientName)
	suite.Equal("localhost:3118", grants[0].RedirectHost)
	suite.NoError(suite.service.RevokeGrant(suite.Ctx, suite.user.ID, grants[0].ID))

	req := httptest.NewRequest(http.MethodGet, "/mcp", nil)
	req.Header.Set("Authorization", "Bearer "+access)
	suite.Equal(http.StatusUnauthorized, suite.do(req).Code)

	suite.ErrorContains(suite.service.RevokeGrant(suite.Ctx, uuid.New(), grants[0].ID), "not found")
}

func TestHandlerSuite(t *testing.T) {
	suite.Run(t, new(HandlerSuite))
}
