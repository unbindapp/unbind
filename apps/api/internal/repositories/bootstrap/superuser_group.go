package bootstrap_repo

import (
	"context"

	"github.com/unbindapp/unbind-api/ent/schema"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// Create the superuser group with system and team admin permissions, if no groups exist yet
func (self *BootstrapRepository) EnsureSuperuserGroup(ctx context.Context, tx repository.TxInterface) error {
	db := tx.Client()

	groupCount, err := db.Group.Query().Count(ctx)
	if err != nil {
		return err
	}
	if groupCount > 0 {
		return nil
	}

	group, err := db.Group.Create().
		SetName("superuser").
		SetDescription("Default superuser group").
		Save(ctx)
	if err != nil {
		return err
	}

	for _, resourceType := range []schema.ResourceType{schema.ResourceTypeSystem, schema.ResourceTypeTeam} {
		perm, err := db.Permission.Create().
			SetAction(schema.ActionAdmin).
			SetResourceType(resourceType).
			SetResourceSelector(schema.ResourceSelector{
				Superuser: true,
			}).
			Save(ctx)
		if err != nil {
			return err
		}

		if _, err := db.Group.UpdateOneID(group.ID).AddPermissionIDs(perm.ID).Save(ctx); err != nil {
			return err
		}
	}

	return nil
}
