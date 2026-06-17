package auth_handler

import (
	"context"
	"net/http"

	"github.com/unbindapp/unbind-api/internal/auth"
)

type LogoutInput struct {
	RefreshToken http.Cookie `cookie:"refresh_token"`
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
	if input.RefreshToken.Value != "" {
		_ = self.srv.Repository.Oauth().RevokeRefreshToken(ctx, input.RefreshToken.Value)
	}

	resp := &LogoutResponse{SetCookie: auth.ClearedSessionCookies(self.srv.Cfg.CookieSecure)}
	resp.Body.Data.Success = true
	return resp, nil
}
