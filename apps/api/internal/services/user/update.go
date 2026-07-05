package user_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

type UpdatePasswordInput struct {
	// Defaults to the requester when nil
	UserID          *uuid.UUID
	CurrentPassword string
	NewPassword     string
}

func (self *UserService) UpdatePassword(ctx context.Context, requesterUserID uuid.UUID, input *UpdatePasswordInput) (*ent.User, error) {
	targetUserID := requesterUserID
	if input.UserID != nil {
		targetUserID = *input.UserID
	}

	target, err := self.repo.User().GetByID(ctx, targetUserID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "User not found")
		}
		return nil, err
	}

	switch targetUserID {
	case requesterUserID:
		if input.CurrentPassword == "" {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Current password is required")
		}
		if _, err := self.repo.User().Authenticate(ctx, target.Email, input.CurrentPassword); err != nil {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Current password is incorrect")
		}
	default:
		permissionChecks := []permissions_repo.PermissionCheck{
			{
				Action:       schema.ActionAdmin,
				ResourceType: schema.ResourceTypeSystem,
			},
		}
		if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
			return nil, err
		}
	}

	if err := self.repo.User().UpdatePassword(ctx, targetUserID, input.NewPassword); err != nil {
		return nil, err
	}

	return target, nil
}
