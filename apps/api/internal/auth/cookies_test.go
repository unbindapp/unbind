package auth

import (
	"testing"
	"time"
)

func TestCookieNamesUseHostPrefixWhenSecure(t *testing.T) {
	if got := AccessTokenCookieName(true); got != "__Host-access_token" {
		t.Errorf("secure access cookie name = %q", got)
	}
	if got := RefreshTokenCookieName(true); got != "__Host-refresh_token" {
		t.Errorf("secure refresh cookie name = %q", got)
	}
	if got := CSRFTokenCookieName(true); got != "__Host-csrf_token" {
		t.Errorf("secure csrf cookie name = %q", got)
	}
	if got := AccessTokenCookieName(false); got != "access_token" {
		t.Errorf("insecure access cookie name = %q", got)
	}
}

// A __Host- cookie is only valid when it is Secure, has Path=/, and carries no
// Domain. Guard those invariants so the prefix is never set on an invalid cookie.
func TestSessionCookiesHostPrefixInvariants(t *testing.T) {
	cookies := SessionCookies("access", time.Now().Add(time.Minute), "refresh", "csrf", true)
	for _, c := range cookies {
		if c.Name[:7] != "__Host-" {
			t.Fatalf("expected __Host- prefix, got %q", c.Name)
		}
		if !c.Secure {
			t.Errorf("%s must be Secure", c.Name)
		}
		if c.Path != "/" {
			t.Errorf("%s must have Path=/, got %q", c.Name, c.Path)
		}
		if c.Domain != "" {
			t.Errorf("%s must not set Domain, got %q", c.Name, c.Domain)
		}
	}

	// CSRF cookie must remain readable by JS; the others must stay HttpOnly.
	for _, c := range cookies {
		wantHTTPOnly := c.Name != "__Host-csrf_token"
		if c.HttpOnly != wantHTTPOnly {
			t.Errorf("%s HttpOnly = %v, want %v", c.Name, c.HttpOnly, wantHTTPOnly)
		}
	}
}
