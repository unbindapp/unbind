package apikey_service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/auth"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/names"
	"github.com/unbindapp/unbind-api/internal/models"
	apikey_repo "github.com/unbindapp/unbind-api/internal/repositories/apikey"
	"github.com/unbindapp/unbind-api/internal/services/keyaccess"
)

// Create issues a key for the requester. A scoped key must name resources the
// requester already holds at the key's role. A full-access key needs no check
// here because the checker intersects it with the owner's grants on every
// request, so it can never reach further than the owner.
func (self *APIKeyService) Create(ctx context.Context, requesterUserID uuid.UUID, input *models.APIKeyCreateInput) (*models.APIKeyCreatedResponse, error) {
	if input.ExpiresAt != nil && !input.ExpiresAt.After(time.Now()) {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "expires_at must be in the future")
	}
	spec := keyaccess.Spec{Role: input.Role, FullAccess: input.FullAccess, Resources: input.Resources, Capabilities: input.Capabilities}
	if err := keyaccess.Validate(spec); err != nil {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
	}
	if err := keyaccess.RequesterHolds(ctx, self.repo.Permissions(), requesterUserID, spec); err != nil {
		return nil, err
	}

	name, err := names.Clean(input.Name)
	if err != nil {
		return nil, err
	}
	takenNames, err := self.repo.APIKey().GetNamesByUser(ctx, nil, requesterUserID)
	if err != nil {
		return nil, err
	}
	if err := names.EnsureFree(name, takenNames, "API key", ""); err != nil {
		return nil, err
	}

	generated, err := auth.NewAPIKey()
	if err != nil {
		return nil, errdefs.NewInternalError(err, "Failed to generate the API key")
	}

	resources := input.Resources
	if resources == nil {
		resources = []schema.APIKeyResource{}
	}
	key, err := self.repo.APIKey().Create(ctx, &apikey_repo.CreateAPIKeyInput{
		UserID:       requesterUserID,
		Name:         name,
		TokenPrefix:  generated.Prefix,
		TokenHash:    generated.Hash,
		Role:         input.Role,
		FullAccess:   input.FullAccess,
		Resources:    resources,
		Capabilities: keyaccess.Capabilities(spec),
		ExpiresAt:    input.ExpiresAt,
	})
	if err != nil {
		return nil, err
	}

	paths, err := keyaccess.ResourcePaths(ctx, self.repo, key.Resources)
	if err != nil {
		return nil, err
	}
	return &models.APIKeyCreatedResponse{
		APIKeyResponse: *models.TransformAPIKeyEntity(key, paths),
		Token:          generated.Token,
	}, nil
}
