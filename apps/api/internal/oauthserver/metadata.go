package oauthserver

import "strings"

// AuthorizationServerMetadata is the RFC 8414 document. No scopes are
// advertised: access is chosen on the consent page, not requested by scope.
type AuthorizationServerMetadata struct {
	Issuer                                     string   `json:"issuer"`
	AuthorizationEndpoint                      string   `json:"authorization_endpoint"`
	TokenEndpoint                              string   `json:"token_endpoint"`
	RegistrationEndpoint                       string   `json:"registration_endpoint"`
	ResponseTypesSupported                     []string `json:"response_types_supported"`
	GrantTypesSupported                        []string `json:"grant_types_supported"`
	CodeChallengeMethodsSupported              []string `json:"code_challenge_methods_supported"`
	TokenEndpointAuthMethodsSupported          []string `json:"token_endpoint_auth_methods_supported"`
	ClientIDMetadataDocumentSupported          bool     `json:"client_id_metadata_document_supported"`
	AuthorizationResponseIssParameterSupported bool     `json:"authorization_response_iss_parameter_supported"`
}

func Issuer(externalUIURL string) string {
	return strings.TrimRight(externalUIURL, "/")
}

func ResourceURL(issuer string) string {
	return issuer + "/mcp"
}

func ResourceMetadataURL(issuer string) string {
	return issuer + "/.well-known/oauth-protected-resource"
}

func ConsentURL(issuer string) string {
	return issuer + "/oauth/consent"
}

func NewAuthorizationServerMetadata(issuer string) AuthorizationServerMetadata {
	return AuthorizationServerMetadata{
		Issuer:                                     issuer,
		AuthorizationEndpoint:                      issuer + "/oauth/authorize",
		TokenEndpoint:                              issuer + "/oauth/token",
		RegistrationEndpoint:                       issuer + "/oauth/register",
		ResponseTypesSupported:                     []string{responseTypeCode},
		GrantTypesSupported:                        []string{grantAuthorization, grantRefresh},
		CodeChallengeMethodsSupported:              []string{"S256"},
		TokenEndpointAuthMethodsSupported:          []string{authMethodNone},
		ClientIDMetadataDocumentSupported:          true,
		AuthorizationResponseIssParameterSupported: true,
	}
}
