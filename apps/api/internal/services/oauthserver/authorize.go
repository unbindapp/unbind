package oauthserver_service

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/models"
	"github.com/unbindapp/unbind-api/internal/oauthserver"
)

const (
	responseTypeCode    = "code"
	codeChallengeS256   = "S256"
	maxStateLen         = 1024
	maxScopeLen         = 512
	unsupportedResponse = "unsupported_response_type"
)

type AuthorizeRequest struct {
	ResponseType        string
	ClientID            string
	RedirectURI         string
	State               string
	CodeChallenge       string
	CodeChallengeMethod string
	Resource            string
	Scope               string
}

// ValidateAuthorize checks an authorization request. Errors raised before the
// client and redirect URI are known are not redirectable; the rest are. An
// absent resource defaults to this instance's MCP resource.
func (self *OAuthServerService) ValidateAuthorize(ctx context.Context, req *AuthorizeRequest) (*ResolvedClient, error) {
	client, err := self.ResolveClient(ctx, req.ClientID)
	if err != nil {
		return nil, err
	}
	if req.RedirectURI == "" {
		return nil, oauthserver.InvalidRequest("redirect_uri is required")
	}
	if !self.redirectAllowed(client, req.RedirectURI) {
		return nil, oauthserver.InvalidRequest("redirect_uri is not registered for this client")
	}

	if req.ResponseType != responseTypeCode {
		return nil, (&oauthserver.Error{Code: unsupportedResponse, Description: "only response_type=code is supported", Status: 400}).Redirect()
	}
	if req.CodeChallengeMethod != codeChallengeS256 {
		return nil, oauthserver.InvalidRequest("code_challenge_method must be S256").Redirect()
	}
	if !oauthserver.ValidPKCEValue(req.CodeChallenge) {
		return nil, oauthserver.InvalidRequest("code_challenge is required and must be 43 to 128 characters").Redirect()
	}
	if len(req.State) > maxStateLen {
		return nil, oauthserver.InvalidRequest("state is too long").Redirect()
	}
	if len(req.Scope) > maxScopeLen {
		return nil, oauthserver.InvalidRequest("scope is too long").Redirect()
	}
	if req.Resource == "" {
		req.Resource = self.resource
	}
	if req.Resource != self.resource {
		return nil, oauthserver.InvalidTarget("resource must be " + self.resource).Redirect()
	}
	self.touchClient(ctx, client, self.now())
	return client, nil
}

func (self *OAuthServerService) redirectAllowed(client *ResolvedClient, redirectURI string) bool {
	for _, registered := range client.RedirectURIs {
		if oauthserver.RedirectURIMatches(registered, redirectURI) {
			return true
		}
	}
	return false
}

// ClientInfo describes a client for the consent page. It refuses redirect URIs
// the client did not register so the page never shows a host it cannot trust.
func (self *OAuthServerService) ClientInfo(ctx context.Context, input *models.ConnectedAppClientInput) (*models.ConnectedAppClientResponse, error) {
	client, err := self.ResolveClient(ctx, input.ClientID)
	if err != nil {
		return nil, err
	}
	if !self.redirectAllowed(client, input.RedirectURI) {
		return nil, oauthserver.InvalidRequest("redirect_uri is not registered for this client")
	}
	return &models.ConnectedAppClientResponse{
		Name:          client.Name,
		Kind:          client.Kind,
		ClientHost:    models.ClientHost(client.Kind, client.ClientID, client.ClientURI),
		RedirectHost:  oauthserver.HostOf(input.RedirectURI),
		LoopbackOnly:  oauthserver.LoopbackOnly(client.RedirectURIs),
		VerifiedBrand: models.VerifiedBrand(client.Kind, client.ClientID, client.RedirectURIs),
	}, nil
}
