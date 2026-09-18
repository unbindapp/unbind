package oauthserver_repo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/oauthgranttoken"
	"github.com/unbindapp/unbind-api/ent/schema"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

type CreateTokensInput struct {
	GrantID          uuid.UUID
	AccessHash       string
	AccessExpiresAt  time.Time
	RefreshHash      string
	RefreshExpiresAt time.Time
}

// CreateTokens writes an access and refresh pair atomically.
func (self *OAuthServerRepository) CreateTokens(ctx context.Context, input *CreateTokensInput) error {
	return self.base.WithTx(ctx, func(tx repository.TxInterface) error {
		_, err := tx.Client().OAuthGrantToken.Create().
			SetGrantID(input.GrantID).
			SetKind(schema.OAuthTokenKindAccess).
			SetTokenHash(input.AccessHash).
			SetExpiresAt(input.AccessExpiresAt).
			Save(ctx)
		if err != nil {
			return err
		}
		_, err = tx.Client().OAuthGrantToken.Create().
			SetGrantID(input.GrantID).
			SetKind(schema.OAuthTokenKindRefresh).
			SetTokenHash(input.RefreshHash).
			SetExpiresAt(input.RefreshExpiresAt).
			Save(ctx)
		return err
	})
}

func (self *OAuthServerRepository) GetTokenByHash(ctx context.Context, tokenHash string) (*ent.OAuthGrantToken, error) {
	return self.base.DB.OAuthGrantToken.Query().
		Where(oauthgranttoken.TokenHash(tokenHash)).
		WithGrant(func(q *ent.OAuthGrantQuery) { q.WithUser() }).
		Only(ctx)
}

// MarkTokenUsed retires a refresh token on rotation. It reports false when the
// token was already retired, which is the reuse signal.
func (self *OAuthServerRepository) MarkTokenUsed(ctx context.Context, id uuid.UUID, now time.Time) (bool, error) {
	updated, err := self.base.DB.OAuthGrantToken.Update().
		Where(oauthgranttoken.ID(id), oauthgranttoken.UsedAtIsNil()).
		SetUsedAt(now).
		Save(ctx)
	return updated == 1, err
}

func (self *OAuthServerRepository) DeleteTokensExpiredOrUsedBefore(ctx context.Context, before time.Time) (int, error) {
	return self.base.DB.OAuthGrantToken.Delete().
		Where(oauthgranttoken.Or(
			oauthgranttoken.ExpiresAtLT(before),
			oauthgranttoken.UsedAtLT(before),
		)).
		Exec(ctx)
}
