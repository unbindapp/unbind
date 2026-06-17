package storage_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/infrastructure/prometheus"
	"github.com/unbindapp/unbind-api/internal/models"
)

func (self *StorageService) ListPVCs(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, input *models.ListPVCInput) ([]*models.PVCInfo, error) {
	team, _, _, err := self.validatePermissionsAndParseInputs(ctx, schema.ActionViewer, requesterUserID, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID)
	if err != nil {
		return nil, err
	}

	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}

	// Build labels to query
	labels := map[string]string{
		"unbind-team": input.TeamID.String(),
	}
	switch input.Type {
	case models.PvcScopeProject:
		labels["unbind-project"] = input.ProjectID.String()
	case models.PvcScopeEnvironment:
		labels["unbind-environment"] = input.EnvironmentID.String()
	}

	// Get the PVCs
	pvcs, err := self.k8s.ListPersistentVolumeClaims(ctx, team.Namespace, labels, client)
	if err != nil {
		return nil, err
	}

	// Get used GB from prometheus
	var pvcNames []string
	for _, pvc := range pvcs {
		pvcNames = append(pvcNames, pvc.ID)
	}

	// Query prometheus
	stats, err := self.promClient.GetPVCsVolumeStats(ctx, pvcNames, team.Namespace, self.k8s.GetInternalClient())
	if err != nil {
		log.Errorf("Failed to get PVC stats from prometheus: %v", err)
		return pvcs, nil
	}

	// Make a map
	pvcStats := make(map[string]*prometheus.PVCVolumeStats)
	for _, stat := range stats {
		pvcStats[stat.PVCName] = stat
	}

	// Add the stats to the PVCs
	for i := range pvcs {
		if stat, ok := pvcStats[pvcs[i].ID]; ok {
			pvcs[i].UsedGB = stat.UsedGB
		}
	}

	// Get mount paths for PVCs
	pathMap, err := self.repo.Service().GetPVCMountPaths(ctx, pvcs)
	if err != nil {
		log.Errorf("Failed to get mount paths for PVCs  %v", err)
		return pvcs, nil
	}

	for i := range pvcs {
		if path, ok := pathMap[pvcs[i].ID]; ok {
			pvcs[i].MountPath = utils.ToPtr(path)
		}
	}

	// Get PVC metadata
	pvcMetadata, err := self.repo.System().GetPVCMetadata(ctx, nil, pvcNames)
	if err != nil {
		log.Errorf("Failed to get PVC metadata: %v", err)
		return nil, err
	}

	// Attach metadata to PVCs
	for i := range pvcs {
		if metadata, ok := pvcMetadata[pvcs[i].ID]; ok {
			if metadata.Name != nil {
				pvcs[i].Name = *metadata.Name
			} else {
				pvcs[i].Name = pvcs[i].ID
			}
			pvcs[i].Description = metadata.Description
		} else {
			pvcs[i].Name = pvcs[i].ID
		}
	}

	return pvcs, nil
}

func (self *StorageService) GetPVC(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, input *models.GetPVCInput) (*models.PVCInfo, error) {
	team, _, _, err := self.validatePermissionsAndParseInputs(ctx, schema.ActionViewer, requesterUserID, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID)
	if err != nil {
		return nil, err
	}

	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}

	// Get the PVC
	pvc, err := self.k8s.GetPersistentVolumeClaim(ctx, team.Namespace, input.ID, client)
	if err != nil {
		return nil, err
	}

	// Ensure it belongs to the team, project, or environment depending on the scope
	switch input.Type {
	case models.PvcScopeTeam:
		if pvc.TeamID != input.TeamID {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "PVC not found")
		}
	case models.PvcScopeProject:
		if pvc.TeamID != input.TeamID || (pvc.ProjectID == nil || *pvc.ProjectID != input.ProjectID) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "PVC not found")
		}
	case models.PvcScopeEnvironment:
		if pvc.TeamID != input.TeamID || (pvc.EnvironmentID == nil || *pvc.EnvironmentID != input.EnvironmentID) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "PVC not found")
		}
	}

	// Get used GB from prometheus
	stats, err := self.promClient.GetPVCsVolumeStats(ctx, []string{pvc.ID}, team.Namespace, self.k8s.GetInternalClient())
	if err != nil {
		log.Errorf("Failed to get PVC stats from prometheus: %v", err)
		return pvc, nil
	}

	// Make a map
	pvcStats := make(map[string]*prometheus.PVCVolumeStats)
	for _, stat := range stats {
		pvcStats[stat.PVCName] = stat
	}

	// Add the stats to the PVC
	if stat, ok := pvcStats[pvc.ID]; ok {
		pvc.UsedGB = stat.UsedGB
	}

	// Get mount paths for PVCs
	pathMap, err := self.repo.Service().GetPVCMountPaths(ctx, []*models.PVCInfo{pvc})
	if err != nil {
		log.Errorf("Failed to get mount paths for PVC %s: %v", pvc.ID, err)
		return pvc, nil
	}

	if path, ok := pathMap[pvc.ID]; ok {
		pvc.MountPath = utils.ToPtr(path)
	}

	// Get PVC metadata
	pvcMetadata, err := self.repo.System().GetPVCMetadata(ctx, nil, []string{pvc.ID})
	if err != nil {
		log.Errorf("Failed to get PVC metadata: %v", err)
		return nil, err
	}

	// Attach metadata to PVC
	if metadata, ok := pvcMetadata[pvc.ID]; ok {
		if metadata.Name != nil {
			pvc.Name = *metadata.Name
		} else {
			pvc.Name = pvc.ID
		}
		pvc.Description = metadata.Description
	} else {
		pvc.Name = pvc.ID
	}

	return pvc, nil
}
