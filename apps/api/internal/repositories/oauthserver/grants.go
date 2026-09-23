package oauthserver_repo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/oauthgrant"
	"github.com/unbindapp/unbind-api/ent/schema"
)

type CreateGrantInput struct {
	UserID       uuid.UUID
	ClientID     string
	ClientName   string
	ClientKind   schema.OAuthClientKind
	ClientURI    string
	RedirectURI  string
	Role         schema.PermittedAction
	FullAccess   bool
	Resources    []schema.APIKeyResource
	Capabilities []schema.KeyCapability
	Resource     string
	Scope        string
}

func (self *OAuthServerRepository) CreateGrant(ctx context.Context, input *CreateGrantInput) (*ent.OAuthGrant, error) {
	return self.base.DB.OAuthGrant.Create().
		SetUserID(input.UserID).
		SetClientID(input.ClientID).
		SetClientName(input.ClientName).
		SetClientKind(input.ClientKind).
		SetClientURI(input.ClientURI).
		SetRedirectURI(input.RedirectURI).
		SetRole(input.Role).
		SetFullAccess(input.FullAccess).
		SetResources(input.Resources).
		SetCapabilities(input.Capabilities).
		SetResource(input.Resource).
		SetScope(input.Scope).
		Save(ctx)
}

func (self *OAuthServerRepository) GetGrantByID(ctx context.Context, id uuid.UUID) (*ent.OAuthGrant, error) {
	return self.base.DB.OAuthGrant.Query().Where(oauthgrant.ID(id)).WithUser().Only(ctx)
}

// ListGrantsByUser returns the user's active grants, newest first.
func (self *OAuthServerRepository) ListGrantsByUser(ctx context.Context, userID uuid.UUID) ([]*ent.OAuthGrant, error) {
	return self.base.DB.OAuthGrant.Query().
		Where(oauthgrant.UserID(userID), oauthgrant.RevokedAtIsNil()).
		Order(ent.Desc(oauthgrant.FieldCreatedAt)).
		All(ctx)
}

func (self *OAuthServerRepository) RevokeGrant(ctx context.Context, id uuid.UUID, now time.Time) error {
	_, err := self.base.DB.OAuthGrant.Update().
		Where(oauthgrant.ID(id), oauthgrant.RevokedAtIsNil()).
		SetRevokedAt(now).
		Save(ctx)
	return err
}

func (self *OAuthServerRepository) TouchGrantLastUsed(ctx context.Context, id uuid.UUID, now time.Time, minInterval time.Duration) error {
	_, err := self.base.DB.OAuthGrant.Update().
		Where(
			oauthgrant.ID(id),
			oauthgrant.Or(
				oauthgrant.LastUsedAtIsNil(),
				oauthgrant.LastUsedAtLT(now.Add(-minInterval)),
			),
		).
		SetLastUsedAt(now).
		Save(ctx)
	return err
}
