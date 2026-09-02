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

func (self *StorageService) DeleteS3BucketByID(ctx context.Context, requesterUserID uuid.UUID, teamID, id uuid.UUID) error {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Team editor can delete s3 buckets
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   teamID,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return err
	}

	team, err := self.repo.Team().GetByID(ctx, teamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return err
	}

	s3Bucket, err := self.getTeamS3Bucket(ctx, team, id)
	if err != nil {
		return err
	}

	client := self.k8s.GetInternalClient()

	return self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		if err := self.repo.S3Bucket().Delete(ctx, tx, id); err != nil {
			return err
		}

		if err := self.k8s.DeleteSecret(ctx, s3Bucket.KubernetesSecret, team.Namespace, client); err != nil {
			log.Errorf("Failed to delete secret %s for s3 bucket %s: %v", s3Bucket.KubernetesSecret, s3Bucket.ID, err)
			return err
		}

		return nil
	})
}
