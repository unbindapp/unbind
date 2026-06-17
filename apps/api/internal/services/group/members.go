package group_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// GetGroupMembers lists all users who are members of a group
func (self *GroupService) GetGroupMembers(ctx context.Context, requesterUserID, groupID uuid.UUID) ([]*ent.User, error) {
	// Get the group to determine its type
	group, err := self.repo.Group().GetByID(ctx, groupID)
	if err != nil {
		// May be ent.NotFound
		return nil, err
	}

	// Check if the user is a member of the group
	isMember, err := self.repo.Group().HasUserWithID(ctx, groupID, requesterUserID)
	if err != nil {
		return nil, err
	}

	// Members always have access so skip permission checks
	if !isMember {
		// Global groups, shared between teams
		if err := self.repo.Permissions().Check(
			ctx,
			requesterUserID,
			[]permissions_repo.PermissionCheck{
				// Has permission to read system resources
				{
					Action:       schema.ActionViewer,
					ResourceType: schema.ResourceTypeSystem,
					ResourceID:   group.ID,
				},
			},
		); err != nil {
			return nil, err
		}
	}

	// Get the group members
	return self.repo.Group().GetMembers(ctx, groupID)
}
