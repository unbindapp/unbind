package auth

import (
	"net/http"
	"time"
)

const (
	AccessTokenCookie  = "access_token"
	RefreshTokenCookie = "refresh_token"
)

func SessionCookies(accessToken string, accessExpiresAt time.Time, refreshToken string, secure bool) []http.Cookie {
	return []http.Cookie{
		newCookie(AccessTokenCookie, accessToken, accessExpiresAt, secure),
		newCookie(RefreshTokenCookie, refreshToken, time.Now().Add(RefreshTokenTTL), secure),
	}
}

func AccessCookie(accessToken string, accessExpiresAt time.Time, secure bool) http.Cookie {
	return newCookie(AccessTokenCookie, accessToken, accessExpiresAt, secure)
}

func ClearedSessionCookies(secure bool) []http.Cookie {
	expired := time.Unix(0, 0)
	return []http.Cookie{
		newCookie(AccessTokenCookie, "", expired, secure),
		newCookie(RefreshTokenCookie, "", expired, secure),
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
