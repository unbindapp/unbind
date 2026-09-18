package middleware

import (
	"net/http"
	"strings"
	"testing"

	"github.com/unbindapp/unbind-api/internal/auth"
)

func TestOAuthTokensRefusedOnREST(t *testing.T) {
	h := newAPIKeyHarness(t)
	access, _ := auth.NewOpaqueToken(auth.OAuthAccessTokenPrefix)
	refresh, _ := auth.NewOpaqueToken(auth.OAuthRefreshTokenPrefix)

	for name, token := range map[string]string{"access": access.Token, "refresh": refresh.Token} {
		t.Run(name, func(t *testing.T) {
			h.last = nil
			resp := h.api.Get("/v1/read", bearer(token))
			if resp.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, body %s", resp.Code, resp.Body.String())
			}
			if !strings.Contains(resp.Body.String(), "MCP endpoint") {
				t.Fatalf("body %s should say where the token is accepted", resp.Body.String())
			}
			if h.last != nil {
				t.Fatal("handler must not run for an OAuth token")
			}
		})
	}
}
