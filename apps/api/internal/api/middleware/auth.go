package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/internal/auth"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

func (self *Middleware) Authenticate(ctx huma.Context, next func(huma.Context)) {
	if token, ok := extractToken(ctx); ok {
		if claims, err := self.tokenManager.Verify(token); err == nil {
			self.proceed(ctx, next, claims.Email, token)
			return
		}
	}

	// No valid access token. Browsers carry a refresh cookie on every request, so
	// transparently mint a fresh access token instead of bouncing them to a login.
	cookie, err := huma.ReadCookie(ctx, auth.RefreshTokenCookie)
	if err != nil || cookie.Value == "" {
		_ = huma.WriteErr(self.api, ctx, http.StatusUnauthorized, "Authentication required")
		return
	}

	stored, err := self.repository.Oauth().GetByRefreshToken(ctx.Context(), cookie.Value)
	if err != nil || stored.Revoked || stored.ExpiresAt.Before(time.Now()) || stored.Edges.User == nil {
		_ = huma.WriteErr(self.api, ctx, http.StatusUnauthorized, "Authentication required")
		return
	}

	user := stored.Edges.User
	groups, err := self.repository.User().GetGroups(ctx.Context(), user.ID)
	if err != nil {
		log.Errorf("auth: load groups: %v", err)
		_ = huma.WriteErr(self.api, ctx, http.StatusInternalServerError, "Failed to process user")
		return
	}

	accessToken, accessExpiresAt, err := self.tokenManager.MintAccessToken(user, groups)
	if err != nil {
		log.Errorf("auth: mint access token: %v", err)
		_ = huma.WriteErr(self.api, ctx, http.StatusInternalServerError, "Failed to process user")
		return
	}

	accessCookie := auth.AccessCookie(accessToken, accessExpiresAt, self.cfg.CookieSecure)
	ctx.AppendHeader("Set-Cookie", accessCookie.String())

	ctx = huma.WithValue(ctx, "user", user)
	ctx = huma.WithValue(ctx, "bearer_token", accessToken)
	next(ctx)
}

func (self *Middleware) proceed(ctx huma.Context, next func(huma.Context), email, token string) {
	user, err := self.repository.User().GetByEmail(ctx.Context(), email)
	if err != nil {
		log.Errorf("auth: load user: %v", err)
		_ = huma.WriteErr(self.api, ctx, http.StatusInternalServerError, "Failed to process user")
		return
	}

	ctx = huma.WithValue(ctx, "user", user)
	ctx = huma.WithValue(ctx, "bearer_token", token)
	next(ctx)
}

func extractToken(ctx huma.Context) (string, bool) {
	if authHeader := ctx.Header("Authorization"); authHeader != "" {
		if !strings.HasPrefix(authHeader, "Bearer ") {
			return "", false
		}
		return strings.TrimPrefix(authHeader, "Bearer "), true
	}

	cookie, err := huma.ReadCookie(ctx, auth.AccessTokenCookie)
	if err != nil || cookie.Value == "" {
		return "", false
	}
	return cookie.Value, true
}
