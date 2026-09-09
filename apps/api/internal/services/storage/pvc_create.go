package storage_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	v1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes"
)

func (self *StorageService) CreatePVC(ctx context.Context, requesterUserID uuid.UUID, input *models.CreatePVCInput) (*models.PVCInfo, error) {
	if (input.ServiceID == nil) != (input.MountPath == nil) {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "service_id and mount_path must be provided together")
	}

	team, _, _, err := self.validatePermissionsAndParseInputs(ctx, schema.ActionEditor, requesterUserID, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID)
	if err != nil {
		return nil, err
	}

	client := self.k8s.GetInternalClient()

	sizeStr := utils.FormatStorageGB(input.CapacityGB)
	_, err = utils.ValidateStorageQuantity(sizeStr)
	if err != nil {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
	}

	attachTo, err := self.validateAttachTarget(ctx, input)
	if err != nil {
		return nil, err
	}

	labels := map[string]string{
		"unbind-team": input.TeamID.String(),
	}
	switch input.Type {
	case models.PvcScopeProject:
		labels["unbind-project"] = input.ProjectID.String()
	case models.PvcScopeEnvironment:
		labels["unbind-project"] = input.ProjectID.String()
		labels["unbind-environment"] = input.EnvironmentID.String()
	}

	kubernetesName, err := utils.GenerateSlug(input.Name)
	if err != nil {
		return nil, err
	}

	err = self.repo.System().UpsertPVCMetadata(
		ctx,
		nil,
		kubernetesName,
		new(input.Name),
		input.Description,
	)
	if err != nil {
		return nil, err
	}

	createdPvc, err := self.k8s.CreatePersistentVolumeClaim(ctx,
		team.Namespace,
		kubernetesName,
		input.Name,
		labels,
		sizeStr,
		[]v1.PersistentVolumeAccessMode{v1.ReadWriteOnce},
		nil,
		client,
	)
	if err != nil {
		return nil, err
	}

	if attachTo != nil {
		attached, err := self.attachNewPVC(ctx, requesterUserID, input, createdPvc)
		if err != nil {
			self.discardPVC(ctx, team.Namespace, createdPvc.ID, client)
			return nil, err
		}
		createdPvc = attached
	}

	createdPvc.Name = input.Name
	createdPvc.Description = input.Description
	return createdPvc, nil
}

// Runs before anything is created so a rejected attach never leaves a volume behind
func (self *StorageService) validateAttachTarget(ctx context.Context, input *models.CreatePVCInput) (*ent.Service, error) {
	if input.ServiceID == nil {
		return nil, nil
	}
	if input.Type != models.PvcScopeEnvironment {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Only environment volumes can be attached to a service")
	}
	if !utils.IsValidUnixPath(*input.MountPath) {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Invalid volume mount path")
	}

	service, err := self.repo.Service().GetByID(ctx, *input.ServiceID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found")
		}
		return nil, err
	}
	if service.EnvironmentID != input.EnvironmentID {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Service not found in this environment")
	}
	if service.Type == schema.ServiceTypeDatabase {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Volumes cannot be attached to database services")
	}
	if service.Edges.ServiceConfig != nil && len(service.Edges.ServiceConfig.Volumes) > 0 {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Service already has a volume attached")
	}
	return service, nil
}

func (self *StorageService) attachNewPVC(ctx context.Context, requesterUserID uuid.UUID, input *models.CreatePVCInput, pvc *models.PVCInfo) (*models.PVCInfo, error) {
	resp, err := self.svcService.UpdateService(ctx, requesterUserID, &models.UpdateServiceInput{
		TeamID:        input.TeamID,
		ProjectID:     input.ProjectID,
		EnvironmentID: input.EnvironmentID,
		ServiceID:     *input.ServiceID,
		AddVolumes:    []schema.ServiceVolume{{ID: pvc.ID, MountPath: *input.MountPath}},
	})
	if err != nil {
		return nil, err
	}
	for _, volume := range resp.Config.Volumes {
		if volume.ID == pvc.ID {
			return volume, nil
		}
	}
	pvc.MountedOnServiceID = input.ServiceID
	pvc.MountPath = input.MountPath
	return pvc, nil
}

func (self *StorageService) discardPVC(ctx context.Context, namespace, pvcID string, client kubernetes.Interface) {
	err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		if err := self.repo.System().DeletePVCMetadata(ctx, tx, pvcID); err != nil {
			return err
		}
		return self.k8s.DeletePersistentVolumeClaim(ctx, namespace, pvcID, client)
	})
	if err != nil {
		log.Errorf("Failed to discard volume %s after attach failed: %v", pvcID, err)
	}
}
