package storage_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// Delete a specific storage backend by ID
func (self *StorageService) DeleteS3StorageByID(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, teamID, id uuid.UUID) error {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Team viewer can view s3 sources
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   teamID,
		},
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return err
	}

	// Check if the team exists
	team, err := self.repo.Team().GetByID(ctx, teamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return err
	}

	// Get all s3 sources for this team
	s3Source, err := self.repo.S3().GetByID(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "S3 source not found")
		}
		return err
	}
	if s3Source.TeamID != team.ID {
		return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "S3 source not found")
	}

	// Create kubernetes client
	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return err
	}

	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		// Delete the s3 source
		if err := self.repo.S3().Delete(ctx, tx, id); err != nil {
			return err
		}

		// Delete the secret
		if err := self.k8s.DeleteSecret(ctx, s3Source.KubernetesSecret, team.Namespace, client); err != nil {
			log.Errorf("Failed to delete secret %s for s3 %s: %v", s3Source.KubernetesSecret, s3Source.ID, err)
			return err
		}

		return nil
	}); err != nil {
		return err
	}

	return nil
}
