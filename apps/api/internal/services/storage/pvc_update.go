package storage_service

import (
	"context"
	"fmt"
	"slices"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

func (self *StorageService) UpdatePVC(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, input *models.UpdatePVCInput) (*models.PVCInfo, error) {
	if input.CapacityGB == nil {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Size is required")
	}

	// Validate permissions and parse inputs
	team, _, _, err := self.validatePermissionsAndParseInputs(ctx, schema.ActionEditor, requesterUserID, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID)
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

	// Size validation
	var newCapacity *string
	if input.CapacityGB != nil {
		// Parse size
		newCapacity = utils.ToPtr(fmt.Sprintf("%fGi", *input.CapacityGB))
		newSize, err := utils.ValidateStorageQuantity(*newCapacity)
		if err != nil {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
		}

		existingSize, err := utils.ValidateStorageQuantityGB(pvc.CapacityGB)
		if err != nil {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
		}

		// Ensure new size is greater than existing size
		if newSize.Cmp(existingSize) < 0 {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "New size must be greater than existing size")
		}
	}

	var targetService *ent.Service
	if pvc.MountedOnServiceID != nil {
		targetService, err = self.repo.Service().GetByID(ctx, *pvc.MountedOnServiceID)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found")
			}
			return nil, err
		}
	}

	updatedPvc := pvc
	var shouldTriggerDeployment bool
	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		err := self.repo.System().UpsertPVCMetadata(ctx, tx, pvc.ID, input.Name, input.Description)
		if err != nil {
			return err
		}

		if input.CapacityGB != nil {
			// If database, then update database spec
			if updatedPvc.IsDatabase && updatedPvc.MountedOnServiceID != nil {
				// Update the database spec with new size
				_, err := self.repo.Service().UpdateDatabaseStorageSize(
					ctx,
					tx,
					*updatedPvc.MountedOnServiceID,
					*newCapacity,
				)
				if err != nil {
					log.Errorf("Failed to update database storage size: %v", err)
					return err
				}

				// Mark that we should trigger deployment after transaction commits
				shouldTriggerDeployment = true
			} else {
				updatedPvc, err = self.k8s.UpdatePersistentVolumeClaim(ctx,
					team.Namespace,
					pvc.ID,
					newCapacity,
					client,
				)
			}
		}

		if err != nil {
			return err
		}

		// Get latest metadata
		pvcMetadata, err := self.repo.System().GetPVCMetadata(ctx, tx, []string{pvc.ID})
		if err != nil {
			return err
		}

		if metadata, ok := pvcMetadata[pvc.ID]; ok {
			if metadata.Name != nil {
				updatedPvc.Name = *metadata.Name
			} else {
				updatedPvc.Name = pvc.ID
			}
			updatedPvc.Description = metadata.Description
		} else {
			updatedPvc.Name = pvc.ID
		}
		return nil

	}); err != nil {
		return nil, err
	}

	// Trigger deployment after transaction is committed
	if shouldTriggerDeployment && targetService != nil {
		// Re-fetch the service to get the updated database config
		targetService, err = self.repo.Service().GetByID(ctx, *pvc.MountedOnServiceID)
		if err != nil {
			log.Errorf("Failed to re-fetch service after database update: %v", err)
		} else {
			// Update underlying PVC for some databases
			if targetService.Database != nil && slices.Contains([]string{"mysql", "redis", "mongodb"}, *targetService.Database) {
				// For Redis and MongoDB, we need to delete the StatefulSet first
				if slices.Contains([]string{"redis", "mongodb"}, *targetService.Database) {
					// Delete StatefulSets with orphan cascade
					err = self.k8s.DeleteStatefulSetsWithOrphanCascade(ctx, team.Namespace, map[string]string{
						"unbind-service": targetService.ID.String(),
					}, self.k8s.GetInternalClient())
					if err != nil {
						log.Errorf("Failed to delete StatefulSets for database %s: %v", *targetService.Database, err)
						return nil, err
					}
				}

				updatedPvc, err = self.k8s.UpdatePersistentVolumeClaim(ctx,
					team.Namespace,
					pvc.ID,
					newCapacity,
					client,
				)
				if err != nil {
					log.Errorf("Failed to update PVC after database update: %v", err)
					return nil, err
				}
			}

			_, err = self.svcService.DeployAdhocServices(ctx, []*ent.Service{targetService})
			if err != nil {
				log.Errorf("Failed to enqueue full build deployments for service %s: %v", targetService.ID, err)
			}

		}
	}

	// Restart pods if needed
	if input.CapacityGB != nil && updatedPvc.MountedOnServiceID != nil {
		err = self.k8s.RollingRestartPodsByLabel(
			ctx,
			team.Namespace,
			"unbind-service",
			(*updatedPvc.MountedOnServiceID).String(),
			client,
		)
		if err != nil {
			log.Error(ctx, "Failed to restart pods after resizing volume: %v", err)
		}
	}

	return updatedPvc, nil
}
