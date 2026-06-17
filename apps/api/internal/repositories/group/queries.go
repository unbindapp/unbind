package group_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/group"
	"github.com/unbindapp/unbind-api/ent/user"
)

func (self *GroupRepository) GetByID(ctx context.Context, id uuid.UUID) (*ent.Group, error) {
	return self.base.DB.Group.Query().
		Where(group.ID(id)).
		WithPermissions().
		Only(ctx)
}

func (self *GroupRepository) GetAllWithK8sRole(ctx context.Context) ([]*ent.Group, error) {
	return self.base.DB.Group.Query().
		Where(
			group.K8sRoleNameNotNil(),
		).
		All(ctx)
}

func (self *GroupRepository) GetAllWithPermissions(ctx context.Context) ([]*ent.Group, error) {
	return self.base.DB.Group.Query().WithPermissions().All(ctx)
}

func (self *GroupRepository) HasUserWithID(ctx context.Context, groupID uuid.UUID, userID uuid.UUID) (bool, error) {
	return self.base.DB.User.Query().
		Where(user.ID(userID)).
		QueryGroups().
		Where(group.ID(groupID)).
		Exist(ctx)
}

func (self *GroupRepository) GetMembers(ctx context.Context, groupID uuid.UUID) ([]*ent.User, error) {
	return self.base.DB.Group.Query().Where(group.ID(groupID)).QueryUsers().All(ctx)
}

func (self *GroupRepository) GetPermissions(ctx context.Context, groupID uuid.UUID) ([]*ent.Permission, error) {
	return self.base.DB.Group.Query().Where(group.ID(groupID)).QueryPermissions().All(ctx)
}
