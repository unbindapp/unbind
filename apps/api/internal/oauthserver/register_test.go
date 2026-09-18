package oauthserver

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func validRegistration() *ClientRegistration {
	return &ClientRegistration{
		ClientName:   "Claude",
		RedirectURIs: []string{"https://claude.ai/api/mcp/auth_callback"},
	}
}

func TestValidateRegistrationFillsDefaults(t *testing.T) {
	reg := validRegistration()
	require.Nil(t, ValidateRegistration(reg))
	assert.Equal(t, []string{"authorization_code", "refresh_token"}, reg.GrantTypes)
	assert.Equal(t, []string{"code"}, reg.ResponseTypes)
	assert.Equal(t, "none", reg.TokenEndpointAuthMethod)
}

func TestValidateRegistrationAcceptsCursorDesktop(t *testing.T) {
	reg := &ClientRegistration{
		ClientName:   "Cursor",
		RedirectURIs: []string{"http://localhost:8787/callback", "cursor://anysphere.cursor-mcp/oauth/callback"},
	}
	require.Nil(t, ValidateRegistration(reg))
}

func TestValidateRegistrationRejects(t *testing.T) {
	cases := map[string]struct {
		mutate func(*ClientRegistration)
		code   string
	}{
		"empty name":         {func(r *ClientRegistration) { r.ClientName = " " }, "invalid_client_metadata"},
		"long name":          {func(r *ClientRegistration) { r.ClientName = strings.Repeat("n", 101) }, "invalid_client_metadata"},
		"no redirects":       {func(r *ClientRegistration) { r.RedirectURIs = nil }, "invalid_redirect_uri"},
		"too many redirects": {func(r *ClientRegistration) { r.RedirectURIs = make([]string, 11) }, "invalid_redirect_uri"},
		"http redirect":      {func(r *ClientRegistration) { r.RedirectURIs = []string{"http://example.com/cb"} }, "invalid_redirect_uri"},
		"client credentials": {func(r *ClientRegistration) { r.GrantTypes = []string{"client_credentials"} }, "invalid_client_metadata"},
		"refresh only":       {func(r *ClientRegistration) { r.GrantTypes = []string{"refresh_token"} }, "invalid_client_metadata"},
		"implicit":           {func(r *ClientRegistration) { r.ResponseTypes = []string{"token"} }, "invalid_client_metadata"},
		"secret auth":        {func(r *ClientRegistration) { r.TokenEndpointAuthMethod = "client_secret_basic" }, "invalid_client_metadata"},
		"http client uri":    {func(r *ClientRegistration) { r.ClientURI = "http://example.com" }, "invalid_client_metadata"},
	}
	for name, c := range cases {
		reg := validRegistration()
		c.mutate(reg)
		err := ValidateRegistration(reg)
		require.NotNil(t, err, name)
		assert.Equal(t, c.code, err.Code, name)
	}
}
