package oauthserver

import (
	"errors"
	"net/url"
	"slices"
	"strings"
)

const maxRedirectURILen = 512

// nativeAppSchemes are the private URI schemes of native clients we know. The
// list is closed on purpose: the consent page navigates to the redirect URI, so
// a scheme like javascript: must never get through.
var nativeAppSchemes = []string{"cursor"}

// ValidateRedirectURI allows https anywhere, plain http only on loopback hosts
// and the private schemes of known native clients (RFC 8252).
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
		if IsNativeAppScheme(parsed.Scheme) {
			return nil
		}
		return errors.New("redirect uri must use https")
	}
}

func IsNativeAppScheme(scheme string) bool {
	return slices.Contains(nativeAppSchemes, strings.ToLower(scheme))
}

// isOnDevice reports whether a redirect lands in an application on the user's
// own device rather than on a website.
func isOnDevice(redirect *url.URL) bool {
	return IsLoopbackHost(redirect.Hostname()) || IsNativeAppScheme(redirect.Scheme)
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
		if err != nil || !isOnDevice(parsed) {
			return false
		}
	}
	return true
}

// HostOf is what the consent page shows for a URI. A native scheme is kept,
// since "anysphere.cursor-mcp" alone would read like a website.
func HostOf(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	if IsNativeAppScheme(parsed.Scheme) {
		return parsed.Scheme + "://" + parsed.Host
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
