package storage_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/dbvolumes"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

// resolveNames fills in the display name and description of every PVC
func (self *StorageService) resolveNames(ctx context.Context, tx repository.TxInterface, pvcs []*models.PVCInfo) error {
	ids := make([]string, len(pvcs))
	for i, pvc := range pvcs {
		ids[i] = pvc.ID
	}

	metadata, err := self.repo.System().GetPVCMetadata(ctx, tx, ids)
	if err != nil {
		return err
	}

	var serviceNames map[uuid.UUID]string
	if serviceIDs := dbvolumes.ServiceIDsNeedingNames(pvcs, metadata); len(serviceIDs) > 0 {
		serviceNames, err = self.repo.Service().GetNamesByIDs(ctx, serviceIDs)
		if err != nil {
			return err
		}
	}

	dbvolumes.ResolveNames(pvcs, metadata, serviceNames)
	return nil
}
