package group_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// GetGroupByID retrieves a group by its ID
func (self *GroupService) GetGroupByID(ctx context.Context, userID uuid.UUID, groupID uuid.UUID) (*ent.Group, error) {
	// Retrieve the group
	group, err := self.repo.Group().GetByID(ctx, groupID)
	if err != nil {
		// May be entNotFound err
		return nil, err
	}

	// Check if the user is a member, in which case they should always have permission
	isMember, err := self.repo.Group().HasUserWithID(ctx, groupID, userID)
	if err != nil {
		return nil, err
	}

	if !isMember {
		permissionChecks := []permissions_repo.PermissionCheck{
			// Has permission to read system resources
			{
				Action:       schema.ActionViewer,
				ResourceType: schema.ResourceTypeSystem,
				ResourceID:   group.ID,
			},
		}

		if err := self.repo.Permissions().Check(
			ctx,
			userID,
			permissionChecks,
		); err != nil {
			return nil, err
		}
	}

	return group, nil
}

// ListGroups retrieves all groups the user has permission to view
func (self *GroupService) ListGroups(ctx context.Context, userID uuid.UUID) ([]*ent.Group, error) {
	// Start with a base query
	query := self.repo.Ent().Group.Query()

	// Always give members access to their own team's groups
	permissionChecks := []permissions_repo.PermissionCheck{
		// Has permission to read system resources
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeSystem,
		},
	}

	if err := self.repo.Permissions().Check(
		ctx,
		userID,
		permissionChecks,
	); err != nil {
		return nil, err
	}

	// Execute the query
	return query.All(ctx)
}
