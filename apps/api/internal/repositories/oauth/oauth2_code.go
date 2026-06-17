package oauth_repo

import (
	"context"
	"time"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/oauth2code"
)

func (self *OauthRepository) CreateAuthCode(ctx context.Context, code, clientID, scope string, user *ent.User, expiresAt time.Time) (*ent.Oauth2Code, error) {
	created, err := self.base.DB.Oauth2Code.Create().SetAuthCode(code).SetClientID(clientID).SetScope(scope).SetUser(user).SetExpiresAt(expiresAt).Save(ctx)
	if err != nil {
		return nil, err
	}
	created.Edges.User = user

	return created, nil
}

func (self *OauthRepository) DeleteAuthCode(ctx context.Context, code string) error {
	_, err := self.base.DB.Oauth2Code.Delete().Where(oauth2code.AuthCode(code)).Exec(ctx)
	return err
}

func (self *OauthRepository) GetAuthCode(ctx context.Context, code string) (*ent.Oauth2Code, error) {
	return self.base.DB.Oauth2Code.Query().Where(oauth2code.AuthCode(code)).WithUser().Only(ctx)
}
