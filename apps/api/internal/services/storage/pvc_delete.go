package storage_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

func (self *StorageService) DeletePVC(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, input *models.DeletePVCInput) error {
	// Validate permissions and parse inputs
	team, _, _, err := self.validatePermissionsAndParseInputs(ctx, schema.ActionEditor, requesterUserID, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID)
	if err != nil {
		return err
	}

	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return err
	}

	// Get the PVC
	pvc, err := self.k8s.GetPersistentVolumeClaim(ctx, team.Namespace, input.ID, client)
	if err != nil {
		return err
	}

	switch input.Type {
	case models.PvcScopeTeam:
		if pvc.TeamID != input.TeamID {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "PVC not found")
		}
	case models.PvcScopeProject:
		if pvc.TeamID != input.TeamID || (pvc.ProjectID == nil || *pvc.ProjectID != input.ProjectID) {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "PVC not found")
		}
	case models.PvcScopeEnvironment:
		if pvc.TeamID != input.TeamID || (pvc.ProjectID == nil || *pvc.ProjectID != input.ProjectID) || (pvc.EnvironmentID == nil || *pvc.EnvironmentID != input.EnvironmentID) {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "PVC not found")
		}
	}

	if !pvc.CanDelete {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "PVC cannot be deleted")
	}

	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		err := self.repo.System().DeletePVCMetadata(ctx, tx, pvc.ID)
		if err != nil {
			return err
		}
		return self.k8s.DeletePersistentVolumeClaim(ctx, team.Namespace, pvc.ID, client)
	}); err != nil {
		return err
	}

	return nil
}
