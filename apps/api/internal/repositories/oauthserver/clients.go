package oauthserver_repo

import (
	"context"
	"time"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/oauthclient"
	"github.com/unbindapp/unbind-api/ent/oauthgrant"
)

type CreateClientInput struct {
	ClientID     string
	Name         string
	RedirectURIs []string
	ClientURI    string
}

func (self *OAuthServerRepository) CreateClient(ctx context.Context, input *CreateClientInput) (*ent.OAuthClient, error) {
	return self.base.DB.OAuthClient.Create().
		SetClientID(input.ClientID).
		SetName(input.Name).
		SetRedirectUris(input.RedirectURIs).
		SetClientURI(input.ClientURI).
		Save(ctx)
}

func (self *OAuthServerRepository) GetClientByClientID(ctx context.Context, clientID string) (*ent.OAuthClient, error) {
	return self.base.DB.OAuthClient.Query().Where(oauthclient.ClientID(clientID)).Only(ctx)
}

func (self *OAuthServerRepository) TouchClientLastUsed(ctx context.Context, id uuid.UUID, now time.Time, minInterval time.Duration) error {
	_, err := self.base.DB.OAuthClient.Update().
		Where(
			oauthclient.ID(id),
			oauthclient.Or(
				oauthclient.LastUsedAtIsNil(),
				oauthclient.LastUsedAtLT(now.Add(-minInterval)),
			),
		).
		SetLastUsedAt(now).
		Save(ctx)
	return err
}

// DeleteOrphanClientsBefore removes registrations that never led to a grant.
func (self *OAuthServerRepository) DeleteOrphanClientsBefore(ctx context.Context, before time.Time) (int, error) {
	return self.base.DB.OAuthClient.Delete().
		Where(
			oauthclient.CreatedAtLT(before),
			func(s *sql.Selector) {
				grants := sql.Table(oauthgrant.Table)
				s.Where(sql.NotExists(
					sql.Select(grants.C(oauthgrant.FieldClientID)).
						From(grants).
						Where(sql.ColumnsEQ(s.C(oauthclient.FieldClientID), grants.C(oauthgrant.FieldClientID))),
				))
			},
		).
		Exec(ctx)
}
