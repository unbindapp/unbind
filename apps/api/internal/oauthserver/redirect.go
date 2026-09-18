package oauthserver

import (
	"errors"
	"net/url"
	"strings"
)

const maxRedirectURILen = 512

// ValidateRedirectURI allows https anywhere and plain http only on loopback
// hosts, which is what native clients use (RFC 8252).
func ValidateRedirectURI(raw string) error {
	if raw == "" {
		return errors.New("redirect uri is required")
	}
	if len(raw) > maxRedirectURILen {
		return errors.New("redirect uri is too long")
	}
	if strings.Contains(raw, "#") {
		return errors.New("redirect uri must not contain a fragment")
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" || parsed.User != nil {
		return errors.New("redirect uri must be an absolute url without credentials")
	}
	switch parsed.Scheme {
	case "https":
		return nil
	case "http":
		if IsLoopbackHost(parsed.Hostname()) {
			return nil
		}
		return errors.New("http redirect uris are only allowed on localhost")
	default:
		return errors.New("redirect uri must use https")
	}
}

func IsLoopbackHost(hostname string) bool {
	switch strings.ToLower(hostname) {
	case "localhost", "127.0.0.1", "::1":
		return true
	}
	return false
}

// RedirectURIMatches is exact, except that loopback http redirects compare with
// the port ignored: native clients bind an ephemeral port per session
// (RFC 8252 §7.3). localhost and 127.0.0.1 never match each other.
func RedirectURIMatches(registered, requested string) bool {
	if registered == requested {
		return true
	}
	reg, err := url.Parse(registered)
	if err != nil {
		return false
	}
	req, err := url.Parse(requested)
	if err != nil {
		return false
	}
	if reg.Scheme != "http" || req.Scheme != "http" {
		return false
	}
	if !IsLoopbackHost(reg.Hostname()) || !IsLoopbackHost(req.Hostname()) {
		return false
	}
	reg.Host = reg.Hostname()
	req.Host = req.Hostname()
	return reg.String() == req.String()
}

// LoopbackOnly reports whether a client can only redirect to this device.
func LoopbackOnly(redirectURIs []string) bool {
	if len(redirectURIs) == 0 {
		return false
	}
	for _, raw := range redirectURIs {
		parsed, err := url.Parse(raw)
		if err != nil || !IsLoopbackHost(parsed.Hostname()) {
			return false
		}
	}
	return true
}

func HostOf(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	return parsed.Host
}

// BuildRedirect appends params to the redirect URI's query, keeping any query
// the client registered.
func BuildRedirect(redirectURI string, params url.Values) string {
	parsed, err := url.Parse(redirectURI)
	if err != nil {
		return redirectURI
	}
	query := parsed.Query()
	for key, values := range params {
		for _, value := range values {
			query.Set(key, value)
		}
	}
	parsed.RawQuery = query.Encode()
	return parsed.String()
}
