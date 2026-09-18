package oauthserver_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	"github.com/unbindapp/unbind-api/internal/services/keyaccess"
)

func (self *OAuthServerService) ListGrants(ctx context.Context, userID uuid.UUID) ([]*models.ConnectedAppResponse, error) {
	grants, err := self.repo.OAuthServer().ListGrantsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	var resources []schema.APIKeyResource
	for _, grant := range grants {
		resources = append(resources, grant.Resources...)
	}
	paths, err := keyaccess.ResourcePaths(ctx, self.repo, resources)
	if err != nil {
		return nil, err
	}
	return models.TransformOAuthGrantEntities(grants, paths), nil
}

// RevokeGrant ends a connected app. Only the owner can, and everyone else sees
// not found so grant ids cannot be probed.
func (self *OAuthServerService) RevokeGrant(ctx context.Context, userID uuid.UUID, id uuid.UUID) error {
	grant, err := self.repo.OAuthServer().GetGrantByID(ctx, id)
	if ent.IsNotFound(err) || (err == nil && grant.UserID != userID) {
		return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Connected app not found")
	}
	if err != nil {
		return err
	}
	return self.repo.OAuthServer().RevokeGrant(ctx, id, self.now())
}
