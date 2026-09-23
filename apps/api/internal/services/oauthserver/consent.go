package oauthserver_service

import (
	"context"
	"errors"
	"net/url"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/auth"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	"github.com/unbindapp/unbind-api/internal/oauthserver"
	oauthserver_repo "github.com/unbindapp/unbind-api/internal/repositories/oauthserver"
	"github.com/unbindapp/unbind-api/internal/services/keyaccess"
)

// Approve records consent as a short lived code. The request is validated again
// here, so a page cannot approve a client or redirect the authorize step refused.
func (self *OAuthServerService) Approve(ctx context.Context, userID uuid.UUID, input *models.ConnectedAppApproveInput) (*models.ConnectedAppRedirectResponse, error) {
	req := &AuthorizeRequest{
		ResponseType:        responseTypeCode,
		ClientID:            input.ClientID,
		RedirectURI:         input.RedirectURI,
		State:               input.State,
		CodeChallenge:       input.CodeChallenge,
		CodeChallengeMethod: codeChallengeS256,
		Resource:            input.Resource,
		Scope:               input.Scope,
	}
	client, err := self.ValidateAuthorize(ctx, req)
	if err != nil {
		return nil, asInputError(err)
	}

	spec := keyaccess.Spec{Role: input.Role, FullAccess: input.FullAccess, Resources: input.Resources, Privileges: input.Privileges}
	if err := keyaccess.Validate(spec); err != nil {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
	}
	if err := keyaccess.RequesterHolds(ctx, self.repo.Permissions(), userID, spec); err != nil {
		return nil, err
	}

	code, err := auth.NewOpaqueToken("")
	if err != nil {
		return nil, errdefs.NewInternalError(err, "Failed to generate the authorization code")
	}
	resources := input.Resources
	if resources == nil {
		resources = []schema.APIKeyResource{}
	}
	_, err = self.repo.OAuthServer().CreateCode(ctx, &oauthserver_repo.CreateCodeInput{
		UserID:        userID,
		CodeHash:      code.Hash,
		ClientID:      client.ClientID,
		ClientName:    client.Name,
		ClientKind:    client.Kind,
		ClientURI:     client.ClientURI,
		RedirectURI:   req.RedirectURI,
		CodeChallenge: req.CodeChallenge,
		Resource:      req.Resource,
		Scope:         req.Scope,
		Role:          input.Role,
		FullAccess:    input.FullAccess,
		Resources:     resources,
		Privileges:    keyaccess.Privileges(spec),
		ExpiresAt:     self.now().Add(CodeTTL),
	})
	if err != nil {
		return nil, err
	}

	params := url.Values{"code": {code.Token}, "iss": {self.issuer}}
	if req.State != "" {
		params.Set("state", req.State)
	}
	return &models.ConnectedAppRedirectResponse{RedirectURL: oauthserver.BuildRedirect(req.RedirectURI, params)}, nil
}

// Deny sends the client an access_denied error, but only to a redirect URI it
// registered.
func (self *OAuthServerService) Deny(ctx context.Context, input *models.ConnectedAppDenyInput) (*models.ConnectedAppRedirectResponse, error) {
	client, err := self.ResolveClient(ctx, input.ClientID)
	if err != nil {
		return nil, asInputError(err)
	}
	if !self.redirectAllowed(client, input.RedirectURI) {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "redirect_uri is not registered for this client")
	}
	if len(input.State) > maxStateLen {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "state is too long")
	}
	return &models.ConnectedAppRedirectResponse{RedirectURL: self.ErrorRedirect(input.RedirectURI, input.State, oauthserver.AccessDenied())}, nil
}

func (self *OAuthServerService) ErrorRedirect(redirectURI, state string, oauthErr *oauthserver.Error) string {
	params := url.Values{"error": {oauthErr.Code}, "iss": {self.issuer}}
	if oauthErr.Description != "" {
		params.Set("error_description", oauthErr.Description)
	}
	if state != "" {
		params.Set("state", state)
	}
	return oauthserver.BuildRedirect(redirectURI, params)
}

func asInputError(err error) error {
	var oauthErr *oauthserver.Error
	if errors.As(err, &oauthErr) {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, oauthErr.Error())
	}
	return err
}
