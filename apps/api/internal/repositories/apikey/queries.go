package apikey_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/apikey"
)

func (self *APIKeyRepository) GetByID(ctx context.Context, id uuid.UUID) (*ent.APIKey, error) {
	return self.base.DB.APIKey.Query().
		Where(apikey.ID(id)).
		WithUser().
		Only(ctx)
}

func (self *APIKeyRepository) GetByTokenHash(ctx context.Context, tokenHash string) (*ent.APIKey, error) {
	return self.base.DB.APIKey.Query().
		Where(apikey.TokenHash(tokenHash)).
		WithUser().
		Only(ctx)
}

func (self *APIKeyRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]*ent.APIKey, error) {
	return self.base.DB.APIKey.Query().
		Where(apikey.UserID(userID)).
		Order(ent.Desc(apikey.FieldCreatedAt)).
		All(ctx)
}
