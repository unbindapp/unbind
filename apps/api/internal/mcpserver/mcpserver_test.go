package mcpserver

import (
	"context"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/humatest"
	"github.com/google/uuid"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/apictx"
	"github.com/unbindapp/unbind-api/internal/api/middleware"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/auth"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	oauthserver_service "github.com/unbindapp/unbind-api/internal/services/oauthserver"
)

const issuer = "https://unbind.example.com"

type received struct {
	userID    uuid.UUID
	hasBearer bool
	access    permissions_repo.APIKeyAccess
	list      listInput
	create    createBody
}

type listInput struct {
	TeamID   uuid.UUID `query:"team_id" required:"true"`
	Statuses []string  `query:"statuses" required:"false"`
	Limit    int       `query:"limit" required:"false"`
}

type owner struct {
	Name string `json:"name" minLength:"1"`
}

type createBody struct {
	Name  string `json:"name" minLength:"1"`
	Owner owner  `json:"owner"`
}

type createInput struct {
	Body createBody
}

type output struct {
	Body struct {
		OK bool `json:"ok"`
	}
}

type fakeKeys struct {
	keys map[string]*ent.APIKey
}

func (self *fakeKeys) GetByTokenHash(_ context.Context, hash string) (*ent.APIKey, error) {
	key, ok := self.keys[hash]
	if !ok {
		return nil, &ent.NotFoundError{}
	}
	return key, nil
}

func (self *fakeKeys) TouchLastUsed(context.Context, uuid.UUID, time.Time, time.Duration) error {
	return nil
}

type fakeOAuth struct {
	tokens map[string]*ent.OAuthGrantToken
}

func (self *fakeOAuth) VerifyAccessToken(_ context.Context, token string) (*ent.OAuthGrantToken, error) {
	stored, ok := self.tokens[token]
	if !ok {
		return nil, oauthserver_service.ErrInvalidAccessToken
	}
	return stored, nil
}

type harness struct {
	t         *testing.T
	url       string
	user      *ent.User
	keys      *fakeKeys
	oauth     *fakeOAuth
	last      *received
	viewer    string
	editor    string
	logReader string
	grant     string
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	h := &harness{
		t:     t,
		user:  &ent.User{ID: uuid.New(), Email: "owner@example.com"},
		keys:  &fakeKeys{keys: map[string]*ent.APIKey{}},
		oauth: &fakeOAuth{tokens: map[string]*ent.OAuthGrantToken{}},
	}

	apiRouter, api := humatest.New(t)
	mw := middleware.NewMiddleware(&config.Config{}, nil, api, nil, nil)
	grp := huma.NewGroup(api, "/things")
	grp.UseMiddleware(mw.Authenticate)
	grp.UseMiddleware(mw.CSRF)

	record := func(ctx context.Context) *received {
		seen := &received{}
		if user, ok := ctx.Value(apictx.UserKey).(*ent.User); ok {
			seen.userID = user.ID
		}
		_, seen.hasBearer = ctx.Value(apictx.BearerTokenKey).(string)
		seen.access, _ = permissions_repo.APIKeyAccessFromContext(ctx)
		h.last = seen
		return seen
	}
	oapi.Register(grp, oapi.Read, huma.Operation{OperationID: "list-things", Description: "List things.", Method: http.MethodGet, Path: "/list"},
		func(ctx context.Context, input *listInput) (*output, error) {
			record(ctx).list = *input
			return &output{}, nil
		}, oapi.MCP)
	oapi.Register(grp, oapi.Create, huma.Operation{OperationID: "create-thing", Description: "Create a thing.", Method: http.MethodPost, Path: "/create"},
		func(ctx context.Context, input *createInput) (*output, error) {
			record(ctx).create = input.Body
			return &output{}, nil
		}, oapi.MCP)
	oapi.Register(grp, oapi.Read, huma.Operation{OperationID: "log-things", Description: "Read logs.", Method: http.MethodGet, Path: "/logs"},
		func(ctx context.Context, _ *struct{}) (*output, error) {
			record(ctx)
			return &output{}, nil
		}, oapi.MCP, oapi.Needs(schema.PrivilegeReadLogs))
	oapi.Register(grp, oapi.Read, huma.Operation{OperationID: "hidden-thing", Description: "Not a tool.", Method: http.MethodGet, Path: "/hidden"},
		func(ctx context.Context, _ *struct{}) (*output, error) {
			record(ctx)
			return &output{}, nil
		}, oapi.NoMCP("test"))

	server, err := New(Options{API: api, Router: apiRouter, OAuth: h.oauth, APIKeys: h.keys, Issuer: issuer, Version: "test"})
	if err != nil {
		t.Fatal(err)
	}
	httpServer := httptest.NewServer(server.handler)
	t.Cleanup(httpServer.Close)
	h.url = httpServer.URL

	h.viewer = h.addKey(permissions_repo.APIKeyAccess{Role: schema.ActionViewer, FullAccess: true}, nil)
	h.editor = h.addKey(permissions_repo.APIKeyAccess{Role: schema.ActionEditor, Resources: []schema.APIKeyResource{{ResourceType: schema.ResourceTypeProject, ResourceID: uuid.New()}}}, nil)
	h.logReader = h.addKey(permissions_repo.APIKeyAccess{Role: schema.ActionViewer, FullAccess: true, Privileges: []schema.KeyPrivilege{schema.PrivilegeReadLogs}}, nil)

	grantToken, _ := auth.NewOpaqueToken(auth.OAuthAccessTokenPrefix)
	h.grant = grantToken.Token
	h.oauth.tokens[h.grant] = &ent.OAuthGrantToken{
		ExpiresAt: time.Now().Add(time.Hour),
		Edges: ent.OAuthGrantTokenEdges{Grant: &ent.OAuthGrant{
			ID:         uuid.New(),
			Role:       schema.ActionEditor,
			FullAccess: true,
			Edges:      ent.OAuthGrantEdges{User: h.user},
		}},
	}
	return h
}

func (h *harness) addKey(access permissions_repo.APIKeyAccess, expiresAt *time.Time) string {
	key, _ := auth.NewAPIKey()
	h.keys.keys[key.Hash] = &ent.APIKey{
		ID:         uuid.New(),
		TokenHash:  key.Hash,
		Role:       access.Role,
		FullAccess: access.FullAccess,
		Resources:  access.Resources,
		Privileges: access.Privileges,
		ExpiresAt:  expiresAt,
		Edges:      ent.APIKeyEdges{User: h.user},
	}
	return key.Token
}

type bearerTransport struct {
	token string
}

func (self bearerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req = req.Clone(req.Context())
	req.Header.Set("Authorization", "Bearer "+self.token)
	return http.DefaultTransport.RoundTrip(req)
}

func (h *harness) connect(token string) *mcp.ClientSession {
	h.t.Helper()
	client := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil)
	session, err := client.Connect(context.Background(), &mcp.StreamableClientTransport{
		Endpoint:   h.url,
		HTTPClient: &http.Client{Transport: bearerTransport{token: token}},
	}, nil)
	if err != nil {
		h.t.Fatal(err)
	}
	h.t.Cleanup(func() { _ = session.Close() })
	return session
}

func (h *harness) call(session *mcp.ClientSession, name string, args map[string]any) (*mcp.CallToolResult, error) {
	h.last = nil
	return session.CallTool(context.Background(), &mcp.CallToolParams{Name: name, Arguments: args})
}

func toolNames(t *testing.T, session *mcp.ClientSession) []string {
	t.Helper()
	listed, err := session.ListTools(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	names := []string{}
	for _, tool := range listed.Tools {
		names = append(names, tool.Name)
	}
	return names
}

func resultText(result *mcp.CallToolResult) string {
	var text strings.Builder
	for _, content := range result.Content {
		if block, ok := content.(*mcp.TextContent); ok {
			text.WriteString(block.Text)
		}
	}
	return text.String()
}

func TestRejectsUnknownCredentials(t *testing.T) {
	h := newHarness(t)
	past := time.Now().Add(-time.Minute)
	expired := h.addKey(permissions_repo.APIKeyAccess{Role: schema.ActionAdmin, FullAccess: true}, &past)

	for name, token := range map[string]string{"none": "", "unknown key": "unb_nope", "expired key": expired, "unknown oauth token": "unbat_nope"} {
		t.Run(name, func(t *testing.T) {
			req, _ := http.NewRequest(http.MethodPost, h.url, strings.NewReader(`{}`))
			if token != "" {
				req.Header.Set("Authorization", "Bearer "+token)
			}
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer func() { _ = resp.Body.Close() }()
			if resp.StatusCode != http.StatusUnauthorized {
				t.Fatalf("status = %d, want 401", resp.StatusCode)
			}
			if !strings.Contains(resp.Header.Get("WWW-Authenticate"), issuer+"/.well-known/oauth-protected-resource") {
				t.Fatalf("challenge %q does not point at the resource metadata", resp.Header.Get("WWW-Authenticate"))
			}
		})
	}
}

func TestToolsFollowTheCredentialsRole(t *testing.T) {
	h := newHarness(t)

	if names := toolNames(t, h.connect(h.viewer)); len(names) != 1 || names[0] != "list-things" {
		t.Fatalf("read only key sees %v, want only list-things", names)
	}
	if names := toolNames(t, h.connect(h.editor)); len(names) != 2 {
		t.Fatalf("editor key sees %v, want list-things and create-thing", names)
	}

	if _, err := h.call(h.connect(h.viewer), "create-thing", map[string]any{"name": "a", "owner": map[string]any{"name": "b"}}); err == nil {
		t.Fatal("a read only key called a write tool")
	}
	if h.last != nil {
		t.Fatal("the write handler ran for a read only key")
	}
}

func TestToolsFollowTheCredentialsPrivileges(t *testing.T) {
	h := newHarness(t)

	if names := toolNames(t, h.connect(h.editor)); slices.Contains(names, "log-things") {
		t.Fatalf("editor key without the read_logs privilege sees %v", names)
	}
	if names := toolNames(t, h.connect(h.logReader)); !slices.Equal(names, []string{"list-things", "log-things"}) {
		t.Fatalf("viewer key with the read_logs privilege sees %v, want list-things and log-things", names)
	}

	if _, err := h.call(h.connect(h.editor), "log-things", nil); err == nil {
		t.Fatal("a key without the privilege called a hidden tool")
	}
	if h.last != nil {
		t.Fatal("the logs handler ran for a key without the privilege")
	}
	result, err := h.call(h.connect(h.logReader), "log-things", nil)
	if err != nil || result.IsError {
		t.Fatalf("key with the privilege: err %v, result %s", err, resultText(result))
	}
}

func TestQueryToolPassesArgumentsAndNarrowedIdentity(t *testing.T) {
	h := newHarness(t)
	teamID := uuid.New()

	result, err := h.call(h.connect(h.editor), "list-things", map[string]any{"team_id": teamID.String(), "statuses": []string{"a", "b"}, "limit": 5})
	if err != nil || result.IsError {
		t.Fatalf("err = %v, result = %+v", err, result)
	}
	if !strings.Contains(resultText(result), `"ok"`) {
		t.Fatalf("result %q is not the endpoint's response", resultText(result))
	}
	if h.last.list.TeamID != teamID || len(h.last.list.Statuses) != 2 || h.last.list.Limit != 5 {
		t.Fatalf("handler received %+v", h.last.list)
	}
	if h.last.userID != h.user.ID {
		t.Fatal("handler did not see the key's owner")
	}
	if h.last.hasBearer {
		t.Fatal("an MCP call must never carry the bearer token used for Kubernetes identity")
	}
	if h.last.access.FullAccess || len(h.last.access.Resources) != 1 || h.last.access.Role != schema.ActionEditor {
		t.Fatalf("access %+v is not the key's", h.last.access)
	}
}

func TestBodyToolIsValidatedByTheEndpoint(t *testing.T) {
	h := newHarness(t)
	session := h.connect(h.grant)

	result, err := h.call(session, "create-thing", map[string]any{"name": "web", "owner": map[string]any{"name": "me"}})
	if err != nil || result.IsError {
		t.Fatalf("err = %v, result = %+v", err, result)
	}
	if h.last.create.Name != "web" || h.last.create.Owner.Name != "me" {
		t.Fatalf("handler received %+v", h.last.create)
	}
	if !h.last.access.FullAccess || h.last.access.Role != schema.ActionEditor {
		t.Fatalf("access %+v is not the grant's", h.last.access)
	}

	result, err = h.call(session, "create-thing", map[string]any{"name": ""})
	if err != nil {
		t.Fatal(err)
	}
	if !result.IsError || h.last != nil {
		t.Fatalf("invalid input must be refused by the endpoint, got %q", resultText(result))
	}
}

func TestUnknownArgumentsAndHiddenOperations(t *testing.T) {
	h := newHarness(t)
	session := h.connect(h.editor)

	result, err := h.call(session, "list-things", map[string]any{"team_id": uuid.NewString(), "nope": 1})
	if err != nil {
		t.Fatal(err)
	}
	if !result.IsError || !strings.Contains(resultText(result), `"nope"`) {
		t.Fatalf("result = %q, want the unknown argument named", resultText(result))
	}

	if _, err := h.call(session, "hidden-thing", nil); err == nil {
		t.Fatal("an operation registered with oapi.NoMCP was callable")
	}
}

func TestSessionOnlyOperationCannotBeATool(t *testing.T) {
	_, api := humatest.New(t)
	oapi.Register(api, oapi.Read, huma.Operation{OperationID: "secret", Method: http.MethodGet, Path: "/secret"},
		func(context.Context, *struct{}) (*output, error) { return &output{}, nil }, oapi.SessionOnly, oapi.MCP)

	if _, err := buildTools(api); err == nil {
		t.Fatal("a session only operation was accepted as a tool")
	}
}

func TestToolSchemaInlinesComponents(t *testing.T) {
	h := newHarness(t)
	listed, err := h.connect(h.editor).ListTools(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, tool := range listed.Tools {
		if tool.Name != "create-thing" {
			continue
		}
		schema := tool.InputSchema.(map[string]any)
		properties := schema["properties"].(map[string]any)
		ref, _ := properties["owner"].(map[string]any)["$ref"].(string)
		defs, _ := schema["$defs"].(map[string]any)
		if !strings.HasPrefix(ref, defsRefPrefix) || defs[strings.TrimPrefix(ref, defsRefPrefix)] == nil {
			t.Fatalf("owner ref %q is not resolvable inside the tool schema: %v", ref, schema)
		}
		return
	}
	t.Fatal("create-thing was not listed")
}
