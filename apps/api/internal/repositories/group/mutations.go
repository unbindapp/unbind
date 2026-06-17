package group_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
)

func (self *GroupRepository) UpdateK8sRoleName(ctx context.Context, g *ent.Group, k8sGroupName string) error {
	// Update the group in our database to store K8s reference
	_, err := self.base.DB.Group.UpdateOne(g).
		SetK8sRoleName(k8sGroupName).
		Save(ctx)
	return err
}

func (self *GroupRepository) ClearK8sRoleName(ctx context.Context, g *ent.Group) error {
	// Update the group in our database to remove K8s reference
	_, err := self.base.DB.Group.UpdateOne(g).
		ClearK8sRoleName().
		Save(ctx)
	return err
}

func (self *GroupRepository) AddUser(ctx context.Context, groupID uuid.UUID, userID uuid.UUID) error {
	_, err := self.base.DB.Group.UpdateOneID(groupID).
		AddUserIDs(userID).
		Save(ctx)
	return err
}

func (self *GroupRepository) RemoveUser(ctx context.Context, groupID uuid.UUID, userID uuid.UUID) error {
	_, err := self.base.DB.Group.UpdateOneID(groupID).
		RemoveUserIDs(userID).
		Save(ctx)
	return err
}
