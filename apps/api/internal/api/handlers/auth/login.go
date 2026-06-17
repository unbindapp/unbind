package auth_handler

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/auth"
)

type LoginInput struct {
	Body struct {
		Email    string `json:"email" format:"email" required:"true"`
		Password string `json:"password" required:"true" minLength:"1"`
	}
}

type SessionUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

type SessionResponse struct {
	SetCookie []http.Cookie `header:"Set-Cookie"`
	Body      struct {
		Data SessionUser `json:"data" nullable:"false"`
	}
}

func (self *HandlerGroup) Login(ctx context.Context, input *LoginInput) (*SessionResponse, error) {
	user, err := self.srv.Repository.User().Authenticate(ctx, input.Body.Email, input.Body.Password)
	if err != nil {
		return nil, huma.Error401Unauthorized("Invalid email or password")
	}

	return self.issueSession(ctx, user)
}

// issueSession mints an access token, persists a rotating refresh token, and
// returns the session cookies.
func (self *HandlerGroup) issueSession(ctx context.Context, user *ent.User) (*SessionResponse, error) {
	groups, err := self.srv.Repository.User().GetGroups(ctx, user.ID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to load groups", err)
	}

	accessToken, accessExpiresAt, err := self.srv.TokenManager.MintAccessToken(user, groups)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to issue token", err)
	}

	refreshToken := auth.NewRefreshToken()
	_, err = self.srv.Repository.Oauth().CreateToken(
		ctx,
		accessToken,
		refreshToken,
		self.srv.Cfg.TokenAudience,
		auth.TokenScope,
		time.Now().Add(auth.RefreshTokenTTL),
		user,
	)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to persist session", err)
	}

	resp := &SessionResponse{
		SetCookie: auth.SessionCookies(accessToken, accessExpiresAt, refreshToken, self.srv.Cfg.CookieSecure),
	}
	resp.Body.Data = SessionUser{ID: user.ID.String(), Email: user.Email}
	return resp, nil
}
