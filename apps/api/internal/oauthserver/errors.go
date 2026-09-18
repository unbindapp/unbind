// Package oauthserver holds the OAuth 2.1 profile MCP clients need, with no
// storage: PKCE, redirect rules, client registration, client metadata
// documents, server metadata and wire errors.
package oauthserver

import (
	"encoding/json"
	"net/http"
)

// Error is an RFC 6749 error. Redirectable errors were raised after the client
// and redirect URI were validated, so the authorize endpoint may send them to
// the client; everything else is answered in place.
type Error struct {
	Code         string `json:"error"`
	Description  string `json:"error_description,omitempty"`
	Status       int    `json:"-"`
	Redirectable bool   `json:"-"`
}

func (e *Error) Error() string {
	if e.Description == "" {
		return e.Code
	}
	return e.Code + ": " + e.Description
}

func (e *Error) Redirect() *Error {
	copied := *e
	copied.Redirectable = true
	return &copied
}

func InvalidRequest(description string) *Error {
	return &Error{Code: "invalid_request", Description: description, Status: http.StatusBadRequest}
}

func InvalidClient(description string) *Error {
	return &Error{Code: "invalid_client", Description: description, Status: http.StatusBadRequest}
}

func InvalidGrant(description string) *Error {
	return &Error{Code: "invalid_grant", Description: description, Status: http.StatusBadRequest}
}

func UnsupportedGrantType() *Error {
	return &Error{Code: "unsupported_grant_type", Description: "only authorization_code and refresh_token are supported", Status: http.StatusBadRequest}
}

func InvalidTarget(description string) *Error {
	return &Error{Code: "invalid_target", Description: description, Status: http.StatusBadRequest}
}

func InvalidClientMetadata(description string) *Error {
	return &Error{Code: "invalid_client_metadata", Description: description, Status: http.StatusBadRequest}
}

func InvalidRedirectURI(description string) *Error {
	return &Error{Code: "invalid_redirect_uri", Description: description, Status: http.StatusBadRequest}
}

func AccessDenied() *Error {
	return &Error{Code: "access_denied", Description: "the user denied the request", Status: http.StatusForbidden, Redirectable: true}
}

func ServerError() *Error {
	return &Error{Code: "server_error", Description: "the server could not complete the request", Status: http.StatusInternalServerError}
}

func WriteJSON(w http.ResponseWriter, err *Error) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")
	w.WriteHeader(err.Status)
	_ = json.NewEncoder(w).Encode(err)
}
