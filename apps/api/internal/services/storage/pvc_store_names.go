package storage_service

import (
	"context"

	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/dbvolumes"
)

// StoreDatabaseVolumeNames runs at startup for the database volumes that were created before
// their names were stored. New ones are named by dbvolumes.Ensure.
func (self *StorageService) StoreDatabaseVolumeNames(ctx context.Context) {
	teams, err := self.repo.Team().GetAll(ctx, nil)
	if err != nil {
		log.Warnf("volume names: failed to list teams: %v", err)
		return
	}

	client := self.k8s.GetInternalClient()
	for _, team := range teams {
		pvcs, err := self.k8s.ListPersistentVolumeClaims(ctx, team.Namespace, map[string]string{"unbind-team": team.ID.String()}, client)
		if err != nil {
			log.Warnf("volume names: failed to list the volumes of team %s: %v", team.ID, err)
			continue
		}
		if err := dbvolumes.StoreDefaultNames(ctx, self.repo, pvcs); err != nil {
			log.Warnf("volume names: failed to store the names of team %s: %v", team.ID, err)
		}
	}
}
