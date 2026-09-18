package oauthserver_service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/oauthserver"
	oauthserver_repo "github.com/unbindapp/unbind-api/internal/repositories/oauthserver"
)

// ResolvedClient is a client either registered dynamically (ID set) or
// described by its metadata document.
type ResolvedClient struct {
	ID           *uuid.UUID
	ClientID     string
	Name         string
	ClientURI    string
	Kind         schema.OAuthClientKind
	RedirectURIs []string
}

func (self *OAuthServerService) ResolveClient(ctx context.Context, clientID string) (*ResolvedClient, error) {
	if clientID == "" {
		return nil, oauthserver.InvalidRequest("client_id is required")
	}
	if oauthserver.IsMetadataDocumentClientID(clientID) {
		doc, err := self.fetcher.Fetch(ctx, clientID)
		if err != nil {
			return nil, err
		}
		return &ResolvedClient{
			ClientID:     doc.ClientID,
			Name:         doc.ClientName,
			ClientURI:    doc.ClientURI,
			Kind:         schema.OAuthClientKindMetadataDocument,
			RedirectURIs: doc.RedirectURIs,
		}, nil
	}

	client, err := self.repo.OAuthServer().GetClientByClientID(ctx, clientID)
	if ent.IsNotFound(err) {
		return nil, oauthserver.InvalidClient("unknown client")
	}
	if err != nil {
		return nil, err
	}
	return &ResolvedClient{
		ID:           &client.ID,
		ClientID:     client.ClientID,
		Name:         client.Name,
		ClientURI:    client.ClientURI,
		Kind:         schema.OAuthClientKindDynamic,
		RedirectURIs: client.RedirectUris,
	}, nil
}

func (self *OAuthServerService) RegisterClient(ctx context.Context, reg *oauthserver.ClientRegistration) (*oauthserver.RegistrationResponse, error) {
	if err := oauthserver.ValidateRegistration(reg); err != nil {
		return nil, err
	}
	client, err := self.repo.OAuthServer().CreateClient(ctx, &oauthserver_repo.CreateClientInput{
		ClientID:     uuid.NewString(),
		Name:         reg.ClientName,
		RedirectURIs: reg.RedirectURIs,
		ClientURI:    reg.ClientURI,
	})
	if err != nil {
		return nil, err
	}
	return &oauthserver.RegistrationResponse{
		ClientID:                client.ClientID,
		ClientIDIssuedAt:        client.CreatedAt.Unix(),
		ClientName:              client.Name,
		RedirectURIs:            client.RedirectUris,
		GrantTypes:              reg.GrantTypes,
		ResponseTypes:           reg.ResponseTypes,
		TokenEndpointAuthMethod: reg.TokenEndpointAuthMethod,
		ClientURI:               client.ClientURI,
	}, nil
}

func (self *OAuthServerService) touchClient(ctx context.Context, client *ResolvedClient, now time.Time) {
	if client.ID == nil {
		return
	}
	if err := self.repo.OAuthServer().TouchClientLastUsed(ctx, *client.ID, now, lastUsedInterval); err != nil {
		log.Warnf("oauth: record client use: %v", err)
	}
}
