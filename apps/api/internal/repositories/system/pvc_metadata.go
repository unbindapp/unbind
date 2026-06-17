package system_repo

import (
	"context"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/pvcmetadata"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

func (self *SystemRepository) UpsertPVCMetadata(ctx context.Context, tx repository.TxInterface, pvcID string, name *string, description *string) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	// See if pvc exists
	existing, err := db.PVCMetadata.Query().Where(
		pvcmetadata.PvcID(pvcID),
	).Only(ctx)

	if err != nil && !ent.IsNotFound(err) {
		return err
	}

	if ent.IsNotFound(err) {
		// Create
		_, err = db.PVCMetadata.Create().
			SetPvcID(pvcID).
			SetNillableName(name).
			SetNillableDescription(description).
			Save(ctx)
		if err != nil {
			return err
		}
		return nil
	}

	// Update
	m := db.PVCMetadata.UpdateOneID(existing.ID)
	if name != nil {
		if *name == "" {
			m.ClearName()
		} else {
			m.SetName(*name)
		}
	}
	if description != nil {
		if *description == "" {
			m.ClearDescription()
		} else {
			m.SetDescription(*description)
		}
	}
	return m.Exec(ctx)
}

func (self *SystemRepository) GetPVCMetadata(ctx context.Context, tx repository.TxInterface, pvcIDs []string) (map[string]*ent.PVCMetadata, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	pvcs, err := db.PVCMetadata.Query().Where(
		pvcmetadata.PvcIDIn(pvcIDs...),
	).All(ctx)
	if err != nil {
		return nil, err
	}

	result := make(map[string]*ent.PVCMetadata)
	for _, pvc := range pvcs {
		result[pvc.PvcID] = pvc
	}

	return result, nil
}

func (self *SystemRepository) DeletePVCMetadata(ctx context.Context, tx repository.TxInterface, pvcID string) error {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	_, err := db.PVCMetadata.Delete().Where(
		pvcmetadata.PvcID(pvcID),
	).Exec(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil
		}
		return err
	}
	return nil
}
