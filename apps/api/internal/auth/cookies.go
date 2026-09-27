package auth

import (
	"net/http"
	"time"
)

const (
	accessTokenBaseName  = "access_token"
	refreshTokenBaseName = "refresh_token"
	csrfTokenBaseName    = "csrf_token"
)

// Cookie names take the __Host- prefix whenever they're Secure. The prefix bars
// a Domain attribute, so a sibling subdomain (e.g. a deployed tenant app) cannot
// set or override these cookies on the control-plane host. The prefix requires
// Secure, so it's dropped in insecure (local HTTP) setups where it'd be invalid.
func AccessTokenCookieName(secure bool) string  { return hostScopedName(accessTokenBaseName, secure) }
func RefreshTokenCookieName(secure bool) string { return hostScopedName(refreshTokenBaseName, secure) }
func CSRFTokenCookieName(secure bool) string    { return hostScopedName(csrfTokenBaseName, secure) }

func hostScopedName(base string, secure bool) string {
	if secure {
		return "__Host-" + base
	}
	return base
}

func SessionCookies(accessToken string, accessExpiresAt time.Time, refreshToken, csrfToken string, secure bool) []http.Cookie {
	refreshExpiresAt := time.Now().Add(RefreshTokenTTL)
	return []http.Cookie{
		newCookie(AccessTokenCookieName(secure), accessToken, accessExpiresAt, secure),
		newCookie(RefreshTokenCookieName(secure), refreshToken, refreshExpiresAt, secure),
		CSRFCookie(csrfToken, refreshExpiresAt, secure),
	}
}

func AccessCookie(accessToken string, accessExpiresAt time.Time, secure bool) http.Cookie {
	return newCookie(AccessTokenCookieName(secure), accessToken, accessExpiresAt, secure)
}

// CSRFCookie carries the double-submit token. It is intentionally not HttpOnly:
// the SPA reads it and echoes the value in the X-CSRF-Token header.
func CSRFCookie(csrfToken string, expires time.Time, secure bool) http.Cookie {
	cookie := newCookie(CSRFTokenCookieName(secure), csrfToken, expires, secure)
	cookie.HttpOnly = false
	return cookie
}

func ClearedSessionCookies(secure bool) []http.Cookie {
	expired := time.Unix(0, 0)
	return []http.Cookie{
		newCookie(AccessTokenCookieName(secure), "", expired, secure),
		newCookie(RefreshTokenCookieName(secure), "", expired, secure),
		CSRFCookie("", expired, secure),
	}
}

func newCookie(name, value string, expires time.Time, secure bool) http.Cookie {
	return http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	}
}
