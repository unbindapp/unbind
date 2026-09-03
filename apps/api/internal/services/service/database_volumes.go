package service_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/dbvolumes"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

func (self *ServiceService) syncDatabaseVolumes(ctx context.Context, tx repository.TxInterface, service *ent.Service, attached []schema.ServiceVolume, client kubernetes.Interface) ([]schema.ServiceVolume, error) {
	desired, err := dbvolumes.PrimaryVolume(service, attached)
	if err != nil || len(desired) == 0 {
		return nil, err
	}
	if len(attached) == 0 {
		return desired, nil
	}

	namespace, err := dbvolumes.Namespace(service)
	if err != nil {
		return nil, err
	}
	if err := self.validateVolumeEngine(ctx, namespace, attached[0].ID, *service.Database, client); err != nil {
		return nil, err
	}
	if err := self.moveVolume(ctx, tx, namespace, attached[0].ID, desired[0].ID, &service.ID, client); err != nil {
		return nil, err
	}
	return desired, nil
}

// claims that predate the engine label pass unchecked
func (self *ServiceService) validateVolumeEngine(ctx context.Context, namespace, pvcName, dbType string, client kubernetes.Interface) error {
	pvc, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, pvcName, metav1.GetOptions{})
	if err != nil {
		return err
	}
	engine, ok := pvc.Labels[dbvolumes.EngineLabel]
	if !ok || engine == dbType {
		return nil
	}
	return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("This volume holds %s data and can only be attached to a %s database", engine, engine))
}

func (self *ServiceService) moveVolume(ctx context.Context, tx repository.TxInterface, namespace, from, to string, serviceID *uuid.UUID, client kubernetes.Interface) error {
	if from != to {
		if _, err := self.k8s.RebindPersistentVolumeClaim(ctx, namespace, from, to, client); err != nil {
			return err
		}
		if err := self.repo.System().RenamePVCMetadata(ctx, tx, from, to); err != nil {
			return err
		}
	}
	return self.k8s.SetPersistentVolumeClaimService(ctx, namespace, to, serviceID, client)
}

func (self *ServiceService) detachDatabaseVolumes(ctx context.Context, tx repository.TxInterface, service *ent.Service, client kubernetes.Interface) error {
	if !dbvolumes.Managed(service) {
		return nil
	}
	namespace, err := dbvolumes.Namespace(service)
	if err != nil {
		return err
	}

	for _, volume := range service.Edges.ServiceConfig.Volumes {
		name, err := self.detachedVolumeName(ctx, tx, volume.ID, service.Name)
		if err != nil {
			return err
		}
		if err := self.moveVolume(ctx, tx, namespace, volume.ID, name, nil, client); err != nil {
			return err
		}
	}
	return nil
}

func (self *ServiceService) detachedVolumeName(ctx context.Context, tx repository.TxInterface, pvcID, fallback string) (string, error) {
	displayName := fallback
	metadata, err := self.repo.System().GetPVCMetadata(ctx, tx, []string{pvcID})
	if err != nil {
		return "", err
	}
	if entry, ok := metadata[pvcID]; ok && entry.Name != nil && *entry.Name != "" {
		displayName = *entry.Name
	}
	return utils.GenerateSlug(displayName)
}

func validateDatabaseVolumeInput(service *ent.Service, overwrite, add, remove []schema.ServiceVolume, replicas *int32) error {
	if len(overwrite) > 1 || len(add) > 1 {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "A database can only have one volume attached")
	}
	if len(add) > 0 && len(service.Edges.ServiceConfig.Volumes) > 0 {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Detach the existing volume before attaching another one")
	}
	if len(remove) > 0 && len(overwrite) > 0 {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Cannot attach and detach a volume in the same request")
	}

	// redis/mongo charts point every replica at the one claim they are given by name
	if replicas != nil && *replicas > 1 && dbvolumes.Managed(service) && dbvolumes.SharesOneClaim(*service.Database) {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "This database cannot be replicated while unbind manages its volume")
	}
	return nil
}

func (self *ServiceService) claimDatabaseVolume(ctx context.Context, tx repository.TxInterface, service *ent.Service, kubernetesName, namespace string, input *models.CreateServiceInput, client kubernetes.Interface) ([]schema.ServiceVolume, error) {
	if input.DatabaseType == nil {
		return nil, nil
	}
	if len(input.Volumes) > 1 {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "A database can only have one volume attached")
	}

	attached := ""
	if len(input.Volumes) > 0 {
		attached = input.Volumes[0].ID
		if err := self.validatePVC(ctx, input.TeamID, input.ProjectID, input.EnvironmentID, attached, namespace, client); err != nil {
			return nil, err
		}
		if err := self.validateVolumeEngine(ctx, namespace, attached, *input.DatabaseType, client); err != nil {
			return nil, err
		}
	}

	replicas := int32(1)
	if input.Replicas != nil {
		replicas = *input.Replicas
	}

	desired, err := dbvolumes.PrimaryVolumeFor(*input.DatabaseType, kubernetesName, service.ID.String(), input.Name, replicas, attached)
	if err != nil || len(desired) == 0 {
		return nil, err
	}
	if attached == "" {
		return desired, nil
	}
	return desired, self.moveVolume(ctx, tx, namespace, attached, desired[0].ID, &service.ID, client)
}

// nil overwrite leaves the config untouched, keeping pre-managed databases on their old path
func (self *ServiceService) resolveDatabaseVolumeChange(ctx context.Context, tx repository.TxInterface, service *ent.Service, input *models.UpdateServiceInput, client kubernetes.Interface) (overwrite, remove []schema.ServiceVolume, err error) {
	if len(input.RemoveVolumes) > 0 {
		if err := self.detachDatabaseVolumes(ctx, tx, service, client); err != nil {
			return nil, nil, err
		}
		return nil, service.Edges.ServiceConfig.Volumes, nil
	}

	attached := input.OverwriteVolumes
	if len(attached) == 0 {
		attached = input.AddVolumes
	}
	if len(attached) == 0 && !dbvolumes.Managed(service) {
		return nil, nil, nil
	}

	overwrite, err = self.syncDatabaseVolumes(ctx, tx, service, attached, client)
	return overwrite, nil, err
}

// the recorded size renders into the CR and volumeClaimTemplates are immutable, so it stays
// frozen and the resize lands on the claims directly
func (self *ServiceService) applyDatabaseStorageSize(ctx context.Context, service *ent.Service, config *schema.DatabaseConfig, client kubernetes.Interface) error {
	if config == nil || !dbvolumes.Managed(service) {
		return nil
	}
	recorded := ""
	if current := service.Edges.ServiceConfig.DatabaseConfig; current != nil {
		recorded = current.StorageSize
	}
	requested := config.StorageSize
	if recorded != "" {
		config.StorageSize = recorded
	}
	if requested == "" || requested == recorded {
		return nil
	}

	namespace, err := dbvolumes.Namespace(service)
	if err != nil {
		return err
	}
	for _, claim := range dbvolumes.Claims(service) {
		if _, err := self.k8s.UpdatePersistentVolumeClaim(ctx, namespace, claim, &requested, client); err != nil {
			return err
		}
	}
	return nil
}
