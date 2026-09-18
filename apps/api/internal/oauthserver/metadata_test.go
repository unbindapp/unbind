package oauthserver

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIssuerAndDerivedURLs(t *testing.T) {
	issuer := Issuer("https://unbind.example.com/")
	assert.Equal(t, "https://unbind.example.com", issuer)
	assert.Equal(t, "https://unbind.example.com/mcp", ResourceURL(issuer))
	assert.Equal(t, "https://unbind.example.com/.well-known/oauth-protected-resource", ResourceMetadataURL(issuer))
	assert.Equal(t, "https://unbind.example.com/oauth/consent", ConsentURL(issuer))
}

func TestAuthorizationServerMetadataJSON(t *testing.T) {
	raw, err := json.Marshal(NewAuthorizationServerMetadata("https://unbind.example.com"))
	require.NoError(t, err)
	var doc map[string]any
	require.NoError(t, json.Unmarshal(raw, &doc))

	assert.Equal(t, "https://unbind.example.com", doc["issuer"])
	assert.Equal(t, "https://unbind.example.com/oauth/authorize", doc["authorization_endpoint"])
	assert.Equal(t, "https://unbind.example.com/oauth/token", doc["token_endpoint"])
	assert.Equal(t, "https://unbind.example.com/oauth/register", doc["registration_endpoint"])
	assert.Equal(t, []any{"S256"}, doc["code_challenge_methods_supported"])
	assert.Equal(t, []any{"none"}, doc["token_endpoint_auth_methods_supported"])
	assert.Equal(t, []any{"authorization_code", "refresh_token"}, doc["grant_types_supported"])
	assert.Equal(t, true, doc["client_id_metadata_document_supported"])
	assert.Equal(t, true, doc["authorization_response_iss_parameter_supported"])
	assert.NotContains(t, doc, "scopes_supported")
}
