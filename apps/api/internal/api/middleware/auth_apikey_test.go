package middleware

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"net/http"
	"testing"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/humatest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/apictx"
	"github.com/unbindapp/unbind-api/internal/api/oapi"
	"github.com/unbindapp/unbind-api/internal/auth"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	mocks_repositories "github.com/unbindapp/unbind-api/mocks/repositories"
	mocks_repository_apikey "github.com/unbindapp/unbind-api/mocks/repository/apikey"
)

type seen struct {
	userID      uuid.UUID
	bearerToken string
	hasBearer   bool
	scopes      []schema.APIKeyScope
	scoped      bool
}

type apiKeyHarness struct {
	api     humatest.TestAPI
	keys    *mocks_repository_apikey.APIKeyRepositoryMock
	user    *ent.User
	last    *seen
	viewKey *auth.GeneratedAPIKey
	editKey *auth.GeneratedAPIKey
}

func newAPIKeyHarness(t *testing.T) *apiKeyHarness {
	t.Helper()
	_, api := humatest.New(t)

	repo := mocks_repositories.NewRepositoriesMock(t)
	keys := mocks_repository_apikey.NewAPIKeyRepositoryMock(t)
	repo.EXPECT().APIKey().Return(keys).Maybe()

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	mw := NewMiddleware(&config.Config{CookieSecure: false}, repo, api, auth.NewTokenManager(privateKey, "issuer", "aud"), []string{"http://localhost:5173"})

	h := &apiKeyHarness{api: api, keys: keys, user: &ent.User{ID: uuid.New(), Email: "owner@example.com"}}

	record := func(ctx context.Context) {
		s := &seen{}
		if user, ok := ctx.Value(apictx.UserKey).(*ent.User); ok {
			s.userID = user.ID
		}
		s.bearerToken, s.hasBearer = ctx.Value(apictx.BearerTokenKey).(string)
		s.scopes, s.scoped = permissions_repo.APIKeyScopesFromContext(ctx)
		h.last = s
	}
	type out struct {
		Body struct {
			OK bool `json:"ok"`
		}
	}
	handler := func(ctx context.Context, _ *struct{}) (*out, error) {
		record(ctx)
		return &out{}, nil
	}

	grp := huma.NewGroup(api, "/v1")
	grp.UseMiddleware(mw.Authenticate)
	grp.UseMiddleware(mw.CSRF)
	oapi.Register(grp, oapi.Read, huma.Operation{OperationID: "read", Method: http.MethodGet, Path: "/read"}, handler)
	oapi.Register(grp, oapi.Create, huma.Operation{OperationID: "write", Method: http.MethodPost, Path: "/write"}, handler)
	oapi.Register(grp, oapi.Read, huma.Operation{OperationID: "secret", Method: http.MethodGet, Path: "/secret"}, handler, oapi.SessionOnly)

	h.viewKey, _ = auth.NewAPIKey()
	h.editKey, _ = auth.NewAPIKey()
	return h
}

func (h *apiKeyHarness) stub(key *auth.GeneratedAPIKey, scopes []schema.APIKeyScope, expiresAt *time.Time) {
	h.keys.EXPECT().GetByTokenHash(mock.Anything, key.Hash).Return(&ent.APIKey{
		ID:        uuid.New(),
		UserID:    h.user.ID,
		TokenHash: key.Hash,
		Scopes:    scopes,
		ExpiresAt: expiresAt,
		Edges:     ent.APIKeyEdges{User: h.user},
	}, nil).Maybe()
	h.keys.EXPECT().TouchLastUsed(mock.Anything, mock.Anything, mock.Anything, apiKeyLastUsedInterval).Return(nil).Maybe()
}

func bearer(token string) string {
	return "Authorization: Bearer " + token
}

func TestAPIKeyAuthenticates(t *testing.T) {
	h := newAPIKeyHarness(t)
	scopes := []schema.APIKeyScope{{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeTeam, ResourceSelector: schema.ResourceSelector{Superuser: true}}}
	h.stub(h.viewKey, scopes, nil)

	resp := h.api.Get("/v1/read", bearer(h.viewKey.Token))
	if resp.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", resp.Code, resp.Body.String())
	}
	if h.last == nil || h.last.userID != h.user.ID {
		t.Fatal("handler did not see the key's owner")
	}
	if h.last.hasBearer {
		t.Fatal("an API key must never populate the bearer token used for Kubernetes identity")
	}
	if !h.last.scoped || len(h.last.scopes) != 1 {
		t.Fatal("key scopes were not attached for the permission checker")
	}
}

func TestAPIKeyRejectsUnknownAndExpired(t *testing.T) {
	h := newAPIKeyHarness(t)
	past := time.Now().Add(-time.Minute)
	h.stub(h.viewKey, nil, &past)
	h.keys.EXPECT().GetByTokenHash(mock.Anything, mock.Anything).Return(nil, &ent.NotFoundError{}).Maybe()

	tests := map[string]string{
		"expired":     h.viewKey.Token,
		"unknown":     h.editKey.Token,
		"prefix only": "unb_",
	}
	for name, token := range tests {
		t.Run(name, func(t *testing.T) {
			h.last = nil
			resp := h.api.Get("/v1/read", bearer(token))
			if resp.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, want 401", resp.Code)
			}
			if h.last != nil {
				t.Fatal("handler ran for a rejected key")
			}
		})
	}
}

func TestAPIKeyRefusedOnSessionOnlyOperation(t *testing.T) {
	h := newAPIKeyHarness(t)
	scopes := []schema.APIKeyScope{{Action: schema.ActionAdmin, ResourceType: schema.ResourceTypeSystem, ResourceSelector: schema.ResourceSelector{Superuser: true}}}
	h.stub(h.editKey, scopes, nil)

	resp := h.api.Get("/v1/secret", bearer(h.editKey.Token))
	if resp.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403 even for a system admin key", resp.Code)
	}
	if h.last != nil {
		t.Fatal("handler ran on a session-only operation")
	}
}

func TestReadOnlyAPIKeyCannotWrite(t *testing.T) {
	h := newAPIKeyHarness(t)
	h.stub(h.viewKey, []schema.APIKeyScope{{Action: schema.ActionViewer, ResourceType: schema.ResourceTypeTeam, ResourceSelector: schema.ResourceSelector{Superuser: true}}}, nil)
	h.stub(h.editKey, []schema.APIKeyScope{{Action: schema.ActionEditor, ResourceType: schema.ResourceTypeProject, ResourceSelector: schema.ResourceSelector{ID: uuid.New()}}}, nil)

	resp := h.api.Post("/v1/write", bearer(h.viewKey.Token))
	if resp.Code != http.StatusForbidden {
		t.Fatalf("view key on a write: status = %d, want 403", resp.Code)
	}

	h.last = nil
	resp = h.api.Post("/v1/write", bearer(h.editKey.Token))
	if resp.Code != http.StatusOK {
		t.Fatalf("edit key on a write without CSRF headers: status = %d, body %s", resp.Code, resp.Body.String())
	}
	if h.last == nil {
		t.Fatal("handler did not run for the edit key")
	}
}

func TestAPIKeyDoesNotFallBackToCookies(t *testing.T) {
	h := newAPIKeyHarness(t)
	h.keys.EXPECT().GetByTokenHash(mock.Anything, mock.Anything).Return(nil, &ent.NotFoundError{}).Maybe()

	resp := h.api.Get("/v1/read", bearer("unb_bogus"), "Cookie: refresh_token=some-session")
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 with no refresh fallback", resp.Code)
	}
}
