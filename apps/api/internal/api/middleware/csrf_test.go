package middleware

import "testing"

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
