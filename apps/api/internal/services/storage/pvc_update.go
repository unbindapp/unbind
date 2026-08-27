package storage_service

import (
	"context"
	"slices"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/dbvolumes"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	"k8s.io/client-go/kubernetes"
)

func (self *StorageService) UpdatePVC(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, input *models.UpdatePVCInput) (*models.PVCInfo, error) {
	if input.CapacityGB == nil && input.Name == nil && input.Description == nil {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Nothing to update")
	}

	team, _, _, err := self.validatePermissionsAndParseInputs(ctx, schema.ActionEditor, requesterUserID, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID)
	if err != nil {
		return nil, err
	}

	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}

	pvc, err := self.k8s.GetPersistentVolumeClaim(ctx, team.Namespace, input.ID, client)
	if err != nil {
		return nil, err
	}

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
		if pvc.TeamID != input.TeamID || (pvc.ProjectID == nil || *pvc.ProjectID != input.ProjectID) || (pvc.EnvironmentID == nil || *pvc.EnvironmentID != input.EnvironmentID) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "PVC not found")
		}
	}

	var newCapacity *string
	var isResize bool
	if input.CapacityGB != nil {
		newCapacity = new(utils.FormatStorageGB(*input.CapacityGB))
		newSize, err := utils.ValidateStorageQuantity(*newCapacity)
		if err != nil {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
		}

		existingSize, err := utils.ValidateStorageQuantityGB(pvc.CapacityGB)
		if err != nil {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
		}

		if newSize.Cmp(existingSize) < 0 {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "New size must be greater than existing size")
		}

		isResize = newSize.Cmp(existingSize) > 0
	}

	var targetService *ent.Service
	if isResize && pvc.MountedOnServiceID != nil {
		targetService, err = self.repo.Service().GetByID(ctx, *pvc.MountedOnServiceID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found")
			}
			return nil, err
		}
	}

	operatorOwned := isResize && pvc.IsDatabase && targetService != nil && !dbvolumes.Managed(targetService)

	updatedPvc := pvc
	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		if err := self.repo.System().UpsertPVCMetadata(ctx, tx, pvc.ID, input.Name, input.Description); err != nil {
			return err
		}

		switch {
		case !isResize:
		case operatorOwned:
			if _, err := self.repo.Service().UpdateDatabaseStorageSize(ctx, tx, targetService.ID, *newCapacity); err != nil {
				return err
			}
		default:
			resized, err := self.resizeClaims(ctx, team.Namespace, pvc, newCapacity, targetService, client)
			if err != nil {
				return err
			}
			updatedPvc = resized
		}

		pvcMetadata, err := self.repo.System().GetPVCMetadata(ctx, tx, []string{pvc.ID})
		if err != nil {
			return err
		}

		updatedPvc.Name = pvc.ID
		if metadata, ok := pvcMetadata[pvc.ID]; ok {
			if metadata.Name != nil {
				updatedPvc.Name = *metadata.Name
			}
			updatedPvc.Description = metadata.Description
		}
		return nil
	}); err != nil {
		return nil, err
	}

	if operatorOwned {
		updatedPvc, err = self.resizeOperatorOwned(ctx, team.Namespace, updatedPvc, newCapacity, targetService, client)
		if err != nil {
			return nil, err
		}
	}

	// filesystem growth needs a remount on drivers without online expansion
	if isResize && pvc.MountedOnServiceID != nil {
		if err := self.k8s.RollingRestartPodsByLabel(ctx, team.Namespace, "unbind-service", pvc.MountedOnServiceID.String(), client); err != nil {
			log.Error(ctx, "Failed to restart pods after resizing volume: %v", err)
		}
	}

	return updatedPvc, nil
}

// replicas each hold a full copy, so all claims grow together
func (self *StorageService) resizeClaims(ctx context.Context, namespace string, pvc *models.PVCInfo, newCapacity *string, targetService *ent.Service, client kubernetes.Interface) (*models.PVCInfo, error) {
	claims := dbvolumes.Claims(targetService)
	if !slices.Contains(claims, pvc.ID) {
		claims = append(claims, pvc.ID)
	}

	updated := pvc
	for _, claim := range claims {
		resized, err := self.k8s.UpdatePersistentVolumeClaim(ctx, namespace, claim, newCapacity, client)
		if err != nil {
			return nil, err
		}
		if claim == pvc.ID {
			updated = resized
		}
	}
	return updated, nil
}

func (self *StorageService) resizeOperatorOwned(ctx context.Context, namespace string, pvc *models.PVCInfo, newCapacity *string, targetService *ent.Service, client kubernetes.Interface) (*models.PVCInfo, error) {
	targetService, err := self.repo.Service().GetByID(ctx, targetService.ID)
	if err != nil {
		return nil, err
	}

	// Altinity's StatefulSet provisioner never resizes a provisioned claim, so clickhouse
	// gets the direct patch too
	updated := pvc
	if targetService.Database != nil && slices.Contains([]string{"mysql", "redis", "mongodb", "clickhouse"}, *targetService.Database) {
		if slices.Contains([]string{"redis", "mongodb"}, *targetService.Database) {
			if err := self.k8s.DeleteStatefulSetsWithOrphanCascade(ctx, namespace, map[string]string{
				"unbind-service": targetService.ID.String(),
			}, self.k8s.GetInternalClient()); err != nil {
				return nil, err
			}
		}

		updated, err = self.k8s.UpdatePersistentVolumeClaim(ctx, namespace, pvc.ID, newCapacity, client)
		if err != nil {
			return nil, err
		}
		updated.Name = pvc.Name
		updated.Description = pvc.Description
	}

	if _, err := self.svcService.DeployAdhocServices(ctx, []*ent.Service{targetService}); err != nil {
		return nil, err
	}
	return updated, nil
}
