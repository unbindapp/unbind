package apikey_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// List returns the requester's keys, or another user's when the requester is
// a system admin.
func (self *APIKeyService) List(ctx context.Context, requesterUserID uuid.UUID, input *models.APIKeyListInput) ([]*models.APIKeyResponse, error) {
	targetUserID := requesterUserID
	if input != nil && input.UserID != uuid.Nil {
		targetUserID = input.UserID
	}

	if targetUserID != requesterUserID {
		if err := self.requireSystemAdmin(ctx, requesterUserID); err != nil {
			return nil, err
		}
	}

	keys, err := self.repo.APIKey().ListByUser(ctx, targetUserID)
	if err != nil {
		return nil, err
	}
	return models.TransformAPIKeyEntities(keys), nil
}

func (self *APIKeyService) requireSystemAdmin(ctx context.Context, requesterUserID uuid.UUID) error {
	return self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionAdmin,
			ResourceType: schema.ResourceTypeSystem,
		},
	})
}

func notFound() error {
	return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "API key not found")
}
