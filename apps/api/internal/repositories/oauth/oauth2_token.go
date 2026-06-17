package oauth_repo

import (
	"context"
	"time"

	"github.com/hashicorp/go-multierror"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/oauth2code"
	"github.com/unbindapp/unbind-api/ent/oauth2token"
)

func (self *OauthRepository) CreateToken(ctx context.Context, accessToken, refreshToken, clientID, scope string, expiresAt time.Time, user *ent.User) (*ent.Oauth2Token, error) {
	created, err := self.base.DB.Oauth2Token.Create().SetAccessToken(accessToken).SetRefreshToken(refreshToken).SetClientID(clientID).SetExpiresAt(expiresAt).SetScope(scope).SetUser(user).Save(ctx)
	if err != nil {
		return nil, err
	}

	created.Edges.User = user

	return created, nil
}

func (self *OauthRepository) RevokeAccessToken(ctx context.Context, accessToken string) error {
	_, err := self.base.DB.Oauth2Token.Update().Where(oauth2token.AccessToken(accessToken)).SetRevoked(true).Save(ctx)
	return err
}

func (self *OauthRepository) RevokeRefreshToken(ctx context.Context, refreshToken string) error {
	_, err := self.base.DB.Oauth2Token.Update().Where(oauth2token.RefreshToken(refreshToken)).SetRevoked(true).Save(ctx)
	return err
}

func (self *OauthRepository) GetByAccessToken(ctx context.Context, accessToken string) (*ent.Oauth2Token, error) {
	return self.base.DB.Oauth2Token.Query().Where(
		oauth2token.AccessToken(accessToken),
	).WithUser().Only(ctx)
}

func (self *OauthRepository) GetByRefreshToken(ctx context.Context, refreshToken string) (*ent.Oauth2Token, error) {
	return self.base.DB.Oauth2Token.Query().Where(
		oauth2token.RefreshToken(refreshToken),
	).WithUser().Only(ctx)
}

func (self *OauthRepository) CleanTokenStore(ctx context.Context) (result error) {

	_, err := self.base.DB.Oauth2Token.Delete().Where(
		oauth2token.Or(
			oauth2token.Revoked(true),
			oauth2token.ExpiresAtLT(time.Now()),
		),
	).Exec(ctx)
	if err != nil {
		result = multierror.Append(result, err)
	}

	_, err = self.base.DB.Oauth2Code.Delete().Where(
		oauth2code.ExpiresAtLT(time.Now()),
	).Exec(ctx)

	if err != nil {
		result = multierror.Append(result, err)
	}

	return result
}
