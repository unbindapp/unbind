package auth_handler

import (
	"context"
	"net/http"

	"github.com/unbindapp/unbind-api/internal/auth"
)

// Read both names: __Host-refresh_token for secure cookies, refresh_token for an
// insecure local API (or a session predating the prefix).
type LogoutInput struct {
	RefreshTokenSecure http.Cookie `cookie:"__Host-refresh_token"`
	RefreshToken       http.Cookie `cookie:"refresh_token"`
}

type LogoutResponse struct {
	SetCookie []http.Cookie `header:"Set-Cookie"`
	Body      struct {
		Data struct {
			Success bool `json:"success"`
		} `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) Logout(ctx context.Context, input *LogoutInput) (*LogoutResponse, error) {
	refreshToken := input.RefreshTokenSecure.Value
	if refreshToken == "" {
		refreshToken = input.RefreshToken.Value
	}
	if refreshToken != "" {
		_ = self.srv.Repository.Oauth().RevokeRefreshToken(ctx, refreshToken)
	}

	resp := &LogoutResponse{SetCookie: auth.ClearedSessionCookies(self.srv.Cfg.CookieSecure)}
	resp.Body.Data.Success = true
	return resp, nil
}
