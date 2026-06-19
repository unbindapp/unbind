package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/auth"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

type authCtxKey string

const (
	userContextKey  authCtxKey = "user"
	tokenContextKey authCtxKey = "bearer_token"
)

// AuthenticateHTTP is the net/http counterpart of Authenticate for raw routes (e.g.
// websockets) that bypass huma.
func (self *Middleware) AuthenticateHTTP(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if token, ok := extractTokenHTTP(r, self.cfg.CookieSecure); ok {
			if claims, err := self.tokenManager.Verify(token); err == nil {
				self.proceedHTTP(w, r, next, claims.Email, token)
				return
			}
		}

		cookie, err := r.Cookie(auth.RefreshTokenCookieName(self.cfg.CookieSecure))
		if err != nil || cookie.Value == "" {
			http.Error(w, "Authentication required", http.StatusUnauthorized)
			return
		}

		stored, err := self.repository.Oauth().GetByRefreshToken(r.Context(), cookie.Value)
		if err != nil || stored.Revoked || stored.ExpiresAt.Before(time.Now()) || stored.Edges.User == nil {
			http.Error(w, "Authentication required", http.StatusUnauthorized)
			return
		}

		user := stored.Edges.User
		groups, err := self.repository.User().GetGroups(r.Context(), user.ID)
		if err != nil {
			log.Errorf("auth: load groups: %v", err)
			http.Error(w, "Failed to process user", http.StatusInternalServerError)
			return
		}

		accessToken, accessExpiresAt, err := self.tokenManager.MintAccessToken(user, groups)
		if err != nil {
			log.Errorf("auth: mint access token: %v", err)
			http.Error(w, "Failed to process user", http.StatusInternalServerError)
			return
		}

		accessCookie := auth.AccessCookie(accessToken, accessExpiresAt, self.cfg.CookieSecure)
		http.SetCookie(w, &accessCookie)
		csrfCookie := auth.CSRFCookie(auth.MintCSRFToken(self.tokenManager.CSRFSecret(), cookie.Value), time.Now().Add(auth.RefreshTokenTTL), self.cfg.CookieSecure)
		http.SetCookie(w, &csrfCookie)

		next.ServeHTTP(w, withAuth(r, user, accessToken))
	})
}

func (self *Middleware) proceedHTTP(w http.ResponseWriter, r *http.Request, next http.Handler, email, token string) {
	user, err := self.repository.User().GetByEmail(r.Context(), email)
	if err != nil {
		log.Errorf("auth: load user: %v", err)
		http.Error(w, "Failed to process user", http.StatusInternalServerError)
		return
	}
	next.ServeHTTP(w, withAuth(r, user, token))
}

func extractTokenHTTP(r *http.Request, secure bool) (token string, ok bool) {
	if authHeader := r.Header.Get("Authorization"); authHeader != "" {
		if !strings.HasPrefix(authHeader, "Bearer ") {
			return "", false
		}
		return strings.TrimPrefix(authHeader, "Bearer "), true
	}

	cookie, err := r.Cookie(auth.AccessTokenCookieName(secure))
	if err != nil || cookie.Value == "" {
		return "", false
	}
	return cookie.Value, true
}

func withAuth(r *http.Request, user *ent.User, token string) *http.Request {
	ctx := context.WithValue(r.Context(), userContextKey, user)
	ctx = context.WithValue(ctx, tokenContextKey, token)
	return r.WithContext(ctx)
}

// UserFromRequest returns the authenticated user set by AuthenticateHTTP.
func UserFromRequest(r *http.Request) (*ent.User, bool) {
	user, ok := r.Context().Value(userContextKey).(*ent.User)
	return user, ok
}

// BearerTokenFromRequest returns the validated access token set by AuthenticateHTTP.
func BearerTokenFromRequest(r *http.Request) (string, bool) {
	token, ok := r.Context().Value(tokenContextKey).(string)
	return token, ok
}
