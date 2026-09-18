package models

import (
	"net/url"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/oauthserver"
)

// ConnectedAppClientResponse describes the client asking for access. The name is
// self reported by the client; the hosts are what the consent page can trust.
type ConnectedAppClientResponse struct {
	Name          string                    `json:"name" doc:"Self reported by the client, unverified."`
	Kind          schema.OAuthClientKind    `json:"kind"`
	ClientHost    string                    `json:"client_host,omitempty" required:"false" doc:"Host that published the client metadata document, when the client has one."`
	RedirectHost  string                    `json:"redirect_host" doc:"Where the browser is sent after approval."`
	LoopbackOnly  bool                      `json:"loopback_only" doc:"The client only redirects to this device."`
	VerifiedBrand oauthserver.VerifiedBrand `json:"verified_brand,omitempty" required:"false" enum:"claude,chatgpt" doc:"Set when the client is proven to be this first party. Its name can then be trusted."`
}

type ConnectedAppRedirectResponse struct {
	RedirectURL string `json:"redirect_url" doc:"Send the browser here to finish the flow."`
}

type ConnectedAppResponse struct {
	ID            uuid.UUID                 `json:"id" format:"uuid"`
	ClientName    string                    `json:"client_name" doc:"Self reported by the client, unverified."`
	ClientID      string                    `json:"client_id"`
	Kind          schema.OAuthClientKind    `json:"kind"`
	ClientHost    string                    `json:"client_host,omitempty" required:"false"`
	RedirectHost  string                    `json:"redirect_host"`
	VerifiedBrand oauthserver.VerifiedBrand `json:"verified_brand,omitempty" required:"false" enum:"claude,chatgpt" doc:"Set when the client is proven to be this first party."`
	Role          schema.PermittedAction    `json:"role"`
	FullAccess    bool                      `json:"full_access"`
	Resources     []APIKeyResourceResponse  `json:"resources" nullable:"false"`
	CreatedAt     time.Time                 `json:"created_at"`
	LastUsedAt    *time.Time                `json:"last_used_at,omitempty" required:"false"`
}

func TransformOAuthGrantEntity(entity *ent.OAuthGrant, paths map[uuid.UUID][]string) *ConnectedAppResponse {
	if entity == nil {
		return &ConnectedAppResponse{}
	}
	resources := make([]APIKeyResourceResponse, 0, len(entity.Resources))
	for _, resource := range entity.Resources {
		path := paths[resource.ResourceID]
		if path == nil {
			path = []string{}
		}
		resources = append(resources, APIKeyResourceResponse{APIKeyResource: resource, Path: path})
	}
	return &ConnectedAppResponse{
		ID:            entity.ID,
		ClientName:    entity.ClientName,
		ClientID:      entity.ClientID,
		Kind:          entity.ClientKind,
		ClientHost:    ClientHost(entity.ClientKind, entity.ClientID, entity.ClientURI),
		RedirectHost:  hostOf(entity.RedirectURI),
		VerifiedBrand: VerifiedBrand(entity.ClientKind, entity.ClientID, []string{entity.RedirectURI}),
		Role:          entity.Role,
		FullAccess:    entity.FullAccess,
		Resources:     resources,
		CreatedAt:     entity.CreatedAt,
		LastUsedAt:    entity.LastUsedAt,
	}
}

func TransformOAuthGrantEntities(entities []*ent.OAuthGrant, paths map[uuid.UUID][]string) []*ConnectedAppResponse {
	responses := make([]*ConnectedAppResponse, len(entities))
	for i, entity := range entities {
		responses[i] = TransformOAuthGrantEntity(entity, paths)
	}
	return responses
}

// ClientHost is the host a user can hold the client to: the metadata document
// host for document clients, else the client_uri host a dynamic client claimed.
func ClientHost(kind schema.OAuthClientKind, clientID, clientURI string) string {
	if kind == schema.OAuthClientKindMetadataDocument {
		return hostOf(clientID)
	}
	return hostOf(clientURI)
}

// VerifiedBrand never vouches for a dynamic client: its registration proves nothing.
func VerifiedBrand(kind schema.OAuthClientKind, clientID string, redirectURIs []string) oauthserver.VerifiedBrand {
	if kind != schema.OAuthClientKindMetadataDocument {
		return ""
	}
	return oauthserver.VerifiedBrandOf(clientID, redirectURIs)
}

func hostOf(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	return parsed.Host
}
