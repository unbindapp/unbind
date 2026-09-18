package oauthserver

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestVerifiedBrandOf(t *testing.T) {
	chatGPT := "https://chatgpt.com/oauth/client.json"
	claudeCode := "https://claude.ai/oauth/claude-code-client-metadata"

	cases := map[string]struct {
		clientID  string
		redirects []string
		want      VerifiedBrand
	}{
		"chatgpt":                  {chatGPT, []string{"https://chatgpt.com/connector_platform_oauth_redirect"}, VerifiedBrandChatGPT},
		"claude code on loopback":  {claudeCode, []string{"http://localhost/callback", "http://127.0.0.1/callback"}, VerifiedBrandClaude},
		"any path on the host":     {"https://claude.ai/oauth/another-client", []string{"https://claude.ai/api/mcp/auth_callback"}, VerifiedBrandClaude},
		"host case":                {"https://ChatGPT.com/oauth/client.json", []string{"https://chatgpt.com/cb"}, VerifiedBrandChatGPT},
		"dynamic client id":        {"3f0e6c1e-0000-4000-8000-000000000000", []string{"https://chatgpt.com/cb"}, ""},
		"unknown host":             {"https://example.com/client.json", []string{"https://example.com/cb"}, ""},
		"lookalike suffix":         {"https://chatgpt.com.evil.example/client.json", []string{"https://chatgpt.com.evil.example/cb"}, ""},
		"lookalike prefix":         {"https://notchatgpt.com/client.json", []string{"https://notchatgpt.com/cb"}, ""},
		"subdomain":                {"https://files.chatgpt.com/client.json", []string{"https://files.chatgpt.com/cb"}, ""},
		"other port":               {"https://chatgpt.com:8443/client.json", []string{"https://chatgpt.com:8443/cb"}, ""},
		"redirect leaves the host": {chatGPT, []string{"https://chatgpt.com/cb", "https://attacker.example/cb"}, ""},
		"redirect to a subdomain":  {chatGPT, []string{"https://evil.chatgpt.com/cb"}, ""},
		"no redirects":             {chatGPT, nil, ""},
		"not https":                {"http://chatgpt.com/client.json", []string{"https://chatgpt.com/cb"}, ""},
	}
	for name, c := range cases {
		assert.Equal(t, c.want, VerifiedBrandOf(c.clientID, c.redirects), name)
	}
}
