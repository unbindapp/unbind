package middleware

import (
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/auth"
)

// CSRF guards cookie-authenticated, state-changing requests. Two independent
// layers must pass: the request Origin must be allow-listed, and the
// X-CSRF-Token header must match the session-bound double-submit token.
//
// Bearer-authenticated requests carry no ambient cookies and so cannot be
// forged cross-site; they are exempt. Must run after Authenticate, which sets
// the auth method on the context.
func (self *Middleware) CSRF(ctx huma.Context, next func(huma.Context)) {
	switch ctx.Method() {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		next(ctx)
		return
	}

	if method, _ := ctx.Context().Value(authMethodKey).(string); method == authMethodBearer {
		next(ctx)
		return
	}

	if !self.originAllowed(ctx) {
		_ = huma.WriteErr(self.api, ctx, http.StatusForbidden, "CSRF: request origin not allowed")
		return
	}

	refresh, err := huma.ReadCookie(ctx, auth.RefreshTokenCookieName(self.cfg.CookieSecure))
	if err != nil || refresh.Value == "" {
		_ = huma.WriteErr(self.api, ctx, http.StatusForbidden, "CSRF: missing session")
		return
	}

	presented := ctx.Header("X-CSRF-Token")
	if presented == "" || !auth.VerifyCSRFToken(self.tokenManager.CSRFSecret(), refresh.Value, presented) {
		_ = huma.WriteErr(self.api, ctx, http.StatusForbidden, "CSRF: token validation failed")
		return
	}

	next(ctx)
}

// refererOrigin extracts the scheme+host prefix from a Referer URL.
func refererOrigin(referer string) string {
	scheme, rest, found := strings.Cut(referer, "://")
	if !found {
		return ""
	}
	host, _, _ := strings.Cut(rest, "/")
	return scheme + "://" + host
}

func (self *Middleware) originAllowed(ctx huma.Context) bool {
	origin := ctx.Header("Origin")
	if origin == "" {
		// Browsers omit Origin on some same-origin requests; fall back to Referer.
		origin = refererOrigin(ctx.Header("Referer"))
	}
	return originMatches(origin, self.allowedOrigins)
}

// originMatches reports whether origin is permitted by the allow-list, honoring
// the same exact / "*" / "*.suffix" patterns as the CORS configuration.
func originMatches(origin string, allowed []string) bool {
	if origin == "" {
		return false
	}

	origin = strings.ToLower(origin)
	host := origin
	if _, after, found := strings.Cut(origin, "://"); found {
		host = after
	}

	for _, pattern := range allowed {
		pattern = strings.ToLower(pattern)
		switch {
		case pattern == "*":
			return true
		case strings.HasPrefix(pattern, "*."):
			if strings.HasSuffix(host, pattern[1:]) {
				return true
			}
		case pattern == origin:
			return true
		}
	}
	return false
}
