package group_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// Input for creating group
type GroupCreateInput struct {
	Name        string `required:"true"`
	Description string `required:"true"`
}

func (self *GroupService) CreateGroup(ctx context.Context, userID uuid.UUID, input *GroupCreateInput) (*ent.Group, error) {
	// Creating a globally scoped group
	// ! TODO - in the long run we may want to scope groups to different teams
	if err := self.repo.Permissions().Check(
		ctx,
		userID,
		[]permissions_repo.PermissionCheck{
			{
				Action:       schema.ActionAdmin,
				ResourceType: schema.ResourceTypeSystem,
			},
		},
	); err != nil {
		return nil, err
	}

	// Start builder
	groupCreate := self.repo.Ent().Group.Create().
		SetName(input.Name).
		SetDescription(input.Description)

	group, err := groupCreate.Save(ctx)
	if err != nil {
		if ent.IsConstraintError(err) {
			return nil, errdefs.ErrGroupAlreadyExists
		}
		return nil, err
	}

	// Add creator as a member
	err = self.repo.Group().AddUser(ctx, group.ID, userID)
	if err != nil {
		return nil, err
	}

	return group, nil
}
