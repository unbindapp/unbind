package apikey_repo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/apikey"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type CreateAPIKeyInput struct {
	UserID      uuid.UUID
	Name        string
	TokenPrefix string
	TokenHash   string
	Role        schema.PermittedAction
	FullAccess  bool
	Resources   []schema.APIKeyResource
	ExpiresAt   *time.Time
}

func (self *APIKeyRepository) Create(ctx context.Context, input *CreateAPIKeyInput) (*ent.APIKey, error) {
	return self.base.DB.APIKey.Create().
		SetUserID(input.UserID).
		SetName(input.Name).
		SetTokenPrefix(input.TokenPrefix).
		SetTokenHash(input.TokenHash).
		SetRole(input.Role).
		SetFullAccess(input.FullAccess).
		SetResources(input.Resources).
		SetNillableExpiresAt(input.ExpiresAt).
		Save(ctx)
}

func (self *APIKeyRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return self.base.DB.APIKey.DeleteOneID(id).Exec(ctx)
}

// TouchLastUsed records use at most once per minInterval so a busy key does not
// write on every request.
func (self *APIKeyRepository) TouchLastUsed(ctx context.Context, id uuid.UUID, now time.Time, minInterval time.Duration) error {
	_, err := self.base.DB.APIKey.Update().
		Where(
			apikey.ID(id),
			apikey.Or(
				apikey.LastUsedAtIsNil(),
				apikey.LastUsedAtLT(now.Add(-minInterval)),
			),
		).
		SetLastUsedAt(now).
		Save(ctx)
	return err
}
