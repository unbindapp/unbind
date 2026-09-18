package oauthserver

import (
	"errors"
	"fmt"
	"net/url"
	"slices"
	"strings"
)

const (
	maxClientNameLen   = 100
	maxRedirectURIs    = 10
	maxClientURILen    = 512
	grantAuthorization = "authorization_code"
	grantRefresh       = "refresh_token"
	responseTypeCode   = "code"
	authMethodNone     = "none"
)

// ClientRegistration is the RFC 7591 request body. Unknown fields are ignored.
type ClientRegistration struct {
	ClientName              string   `json:"client_name"`
	RedirectURIs            []string `json:"redirect_uris"`
	GrantTypes              []string `json:"grant_types,omitempty"`
	ResponseTypes           []string `json:"response_types,omitempty"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method,omitempty"`
	ClientURI               string   `json:"client_uri,omitempty"`
}

type RegistrationResponse struct {
	ClientID                string   `json:"client_id"`
	ClientIDIssuedAt        int64    `json:"client_id_issued_at"`
	ClientName              string   `json:"client_name"`
	RedirectURIs            []string `json:"redirect_uris"`
	GrantTypes              []string `json:"grant_types"`
	ResponseTypes           []string `json:"response_types"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`
	ClientURI               string   `json:"client_uri,omitempty"`
}

// ValidateRegistration checks a public client and fills in the defaults the
// response echoes back.
func ValidateRegistration(reg *ClientRegistration) *Error {
	reg.ClientName = strings.TrimSpace(reg.ClientName)
	if reg.ClientName == "" {
		return InvalidClientMetadata("client_name is required")
	}
	if len(reg.ClientName) > maxClientNameLen {
		return InvalidClientMetadata("client_name is too long")
	}
	if len(reg.RedirectURIs) == 0 {
		return InvalidRedirectURI("redirect_uris is required")
	}
	if len(reg.RedirectURIs) > maxRedirectURIs {
		return InvalidRedirectURI(fmt.Sprintf("at most %d redirect_uris are allowed", maxRedirectURIs))
	}
	for _, uri := range reg.RedirectURIs {
		if err := ValidateRedirectURI(uri); err != nil {
			return InvalidRedirectURI(err.Error())
		}
	}
	if len(reg.GrantTypes) == 0 {
		reg.GrantTypes = []string{grantAuthorization, grantRefresh}
	}
	for _, grant := range reg.GrantTypes {
		if grant != grantAuthorization && grant != grantRefresh {
			return InvalidClientMetadata(fmt.Sprintf("grant type %q is not supported", grant))
		}
	}
	if !slices.Contains(reg.GrantTypes, grantAuthorization) {
		return InvalidClientMetadata("grant_types must include authorization_code")
	}
	if len(reg.ResponseTypes) == 0 {
		reg.ResponseTypes = []string{responseTypeCode}
	}
	for _, response := range reg.ResponseTypes {
		if response != responseTypeCode {
			return InvalidClientMetadata(fmt.Sprintf("response type %q is not supported", response))
		}
	}
	if reg.TokenEndpointAuthMethod != "" && reg.TokenEndpointAuthMethod != authMethodNone {
		return InvalidClientMetadata("only public clients (token_endpoint_auth_method none) are supported")
	}
	reg.TokenEndpointAuthMethod = authMethodNone
	if err := validateClientURI(reg.ClientURI); err != nil {
		return InvalidClientMetadata(err.Error())
	}
	return nil
}

func validateClientURI(raw string) error {
	if raw == "" {
		return nil
	}
	if len(raw) > maxClientURILen {
		return errors.New("client_uri is too long")
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return errors.New("client_uri must be an https url")
	}
	return nil
}
