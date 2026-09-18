package oauthserver

import (
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidateRedirectURI(t *testing.T) {
	valid := []string{
		"https://claude.ai/api/mcp/auth_callback",
		"https://example.com:8443/cb?x=1",
		"http://localhost/callback",
		"http://localhost:3118/callback",
		"http://127.0.0.1:52000/callback",
		"http://[::1]:9/cb",
	}
	for _, uri := range valid {
		assert.NoError(t, ValidateRedirectURI(uri), uri)
	}

	invalid := []string{
		"",
		"http://example.com/callback",
		"http://localhost.evil.com/callback",
		"https://example.com/cb#frag",
		"https://user:pw@example.com/cb",
		"ftp://example.com/cb",
		"/relative",
		"https://" + strings.Repeat("a", 520) + ".com/",
		"myapp://callback",
	}
	for _, uri := range invalid {
		assert.Error(t, ValidateRedirectURI(uri), uri)
	}
}

func TestRedirectURIMatches(t *testing.T) {
	cases := []struct {
		registered, requested string
		want                  bool
	}{
		{"https://claude.ai/api/mcp/auth_callback", "https://claude.ai/api/mcp/auth_callback", true},
		{"https://claude.ai/api/mcp/auth_callback", "https://claude.ai/api/mcp/auth_callback/", false},
		{"https://example.com/cb", "https://example.com:8443/cb", false},
		{"https://example.com:8443/cb", "https://example.com/cb", false},
		{"http://localhost/callback", "http://localhost:3118/callback", true},
		{"http://127.0.0.1/callback", "http://127.0.0.1:52000/callback", true},
		{"http://localhost:3000/callback", "http://localhost:4000/callback", true},
		{"http://localhost/callback", "http://127.0.0.1:3118/callback", false},
		{"http://localhost/callback", "http://localhost:3118/other", false},
		{"http://localhost/callback", "https://localhost:3118/callback", false},
		{"http://localhost/callback?a=1", "http://localhost:3118/callback?a=1", true},
		{"http://localhost/callback", "http://localhost:3118/callback?a=1", false},
	}
	for _, c := range cases {
		assert.Equal(t, c.want, RedirectURIMatches(c.registered, c.requested), "%s vs %s", c.registered, c.requested)
	}
}

func TestLoopbackOnly(t *testing.T) {
	assert.True(t, LoopbackOnly([]string{"http://localhost/callback", "http://127.0.0.1/callback"}))
	assert.False(t, LoopbackOnly([]string{"http://localhost/callback", "https://claude.ai/api/mcp/auth_callback"}))
	assert.False(t, LoopbackOnly(nil))
}

func TestBuildRedirect(t *testing.T) {
	got := BuildRedirect("http://localhost:3118/callback?keep=1", url.Values{"code": {"abc"}, "state": {"s t"}})
	parsed, err := url.Parse(got)
	assert.NoError(t, err)
	assert.Equal(t, "1", parsed.Query().Get("keep"))
	assert.Equal(t, "abc", parsed.Query().Get("code"))
	assert.Equal(t, "s t", parsed.Query().Get("state"))
	assert.Equal(t, "/callback", parsed.Path)
}
