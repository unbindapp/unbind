package apikey_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
)

// Delete revokes a key. Owners revoke their own keys; system admins revoke
// anyone's. Everyone else sees not found, so key ids cannot be probed.
func (self *APIKeyService) Delete(ctx context.Context, requesterUserID uuid.UUID, id uuid.UUID) error {
	key, err := self.repo.APIKey().GetByID(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return notFound()
		}
		return err
	}

	if key.UserID != requesterUserID {
		if err := self.requireSystemAdmin(ctx, requesterUserID); err != nil {
			return errdefs.MaskAsNotFound(err, "API key not found")
		}
	}

	return self.repo.APIKey().Delete(ctx, id)
}
