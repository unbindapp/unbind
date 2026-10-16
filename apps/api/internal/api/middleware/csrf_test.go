package middleware

import (
	"context"
	"net/http"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/humatest"
)

func TestOriginMatches(t *testing.T) {
	allowed := []string{"https://app.unbind.app", "http://localhost:5173", "*.unbind.app"}

	tests := map[string]struct {
		origin  string
		allowed []string
		want    bool
	}{
		"exact match":               {"https://app.unbind.app", allowed, true},
		"exact match with port":     {"http://localhost:5173", allowed, true},
		"wildcard subdomain":        {"https://foo.unbind.app", allowed, true},
		"case insensitive":          {"https://APP.unbind.app", allowed, true},
		"empty origin rejected":     {"", allowed, false},
		"unrelated origin rejected": {"https://evil.com", allowed, false},
		"lookalike domain rejected": {"https://evilunbind.app", allowed, false},
		"wrong port rejected":       {"http://localhost:3000", allowed, false},
		"wildcard all":              {"https://anything.com", []string{"*"}, true},
		"no patterns rejects":       {"https://app.unbind.app", nil, false},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			if got := originMatches(tc.origin, tc.allowed); got != tc.want {
				t.Fatalf("originMatches(%q) = %v, want %v", tc.origin, got, tc.want)
			}
		})
	}
}

func TestRefererOrigin(t *testing.T) {
	tests := map[string]struct {
		referer string
		want    string
	}{
		"with path": {"https://app.unbind.app/projects/123", "https://app.unbind.app"},
		"root":      {"https://app.unbind.app/", "https://app.unbind.app"},
		"no path":   {"https://app.unbind.app", "https://app.unbind.app"},
		"with port": {"http://localhost:5173/x", "http://localhost:5173"},
		"malformed": {"not-a-url", ""},
		"empty":     {"", ""},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			if got := refererOrigin(tc.referer); got != tc.want {
				t.Fatalf("refererOrigin(%q) = %q, want %q", tc.referer, got, tc.want)
			}
		})
	}
}

// A public write such as login is refused when a browser sends it from a foreign
// site, and left alone for scripts and webhooks that send no Origin
func TestRequireAllowedOrigin(t *testing.T) {
	_, api := humatest.New(t)
	mw := &Middleware{api: api, allowedOrigins: []string{"https://unbind.example.com"}}
	huma.Post(api, "/login", func(ctx context.Context, _ *struct{}) (*struct{}, error) { return nil, nil }, func(op *huma.Operation) {
		op.Middlewares = huma.Middlewares{mw.RequireAllowedOrigin}
	})
	huma.Get(api, "/health", func(ctx context.Context, _ *struct{}) (*struct{}, error) { return nil, nil }, func(op *huma.Operation) {
		op.Middlewares = huma.Middlewares{mw.RequireAllowedOrigin}
	})

	tests := map[string]struct {
		do   func() int
		want int
	}{
		"own origin":     {func() int { return api.Post("/login", "Origin: https://unbind.example.com").Code }, http.StatusNoContent},
		"foreign origin": {func() int { return api.Post("/login", "Origin: https://evil.example").Code }, http.StatusForbidden},
		"no origin":      {func() int { return api.Post("/login").Code }, http.StatusNoContent},
		"foreign read":   {func() int { return api.Get("/health", "Origin: https://evil.example").Code }, http.StatusNoContent},
	}
	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			if got := tc.do(); got != tc.want {
				t.Fatalf("status = %d, want %d", got, tc.want)
			}
		})
	}
}
