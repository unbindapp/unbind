package storage_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *StorageService) GetS3BucketByID(ctx context.Context, requesterUserID uuid.UUID, teamID, id uuid.UUID) (*models.S3BucketResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Team viewer can view s3 buckets
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   teamID,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, errdefs.MaskAsNotFound(err, "S3 bucket not found")
	}

	team, err := self.repo.Team().GetByID(ctx, teamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, err
	}

	s3Bucket, err := self.getTeamS3Bucket(ctx, team, id)
	if err != nil {
		return nil, err
	}

	secret, err := self.k8s.GetSecret(ctx, s3Bucket.KubernetesSecret, team.Namespace, self.k8s.GetInternalClient())
	if err != nil {
		log.Errorf("Failed to get secret %s for s3 bucket %s: %v", s3Bucket.KubernetesSecret, s3Bucket.ID, err)
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Secret not found")
	}

	return models.TransformS3BucketEntity(s3Bucket, string(secret.Data["access_key_id"]), string(secret.Data["secret_key"])), nil
}

func (self *StorageService) ListS3Buckets(ctx context.Context, requesterUserID uuid.UUID, teamID uuid.UUID) ([]*models.S3BucketResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Team viewer can view s3 buckets
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   teamID,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, errdefs.MaskAsNotFound(err, "Team not found")
	}

	team, err := self.repo.Team().GetByID(ctx, teamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, err
	}

	s3Buckets, err := self.repo.S3Bucket().GetByTeam(ctx, team.ID)
	if err != nil {
		return nil, err
	}
	if len(s3Buckets) == 0 {
		return []*models.S3BucketResponse{}, nil
	}

	client := self.k8s.GetInternalClient()

	accessKeyMap := make(map[uuid.UUID]string)
	secretKeyMap := make(map[uuid.UUID]string)
	for _, s3Bucket := range s3Buckets {
		secret, err := self.k8s.GetSecret(ctx, s3Bucket.KubernetesSecret, team.Namespace, client)
		if err != nil {
			log.Errorf("Failed to get secret %s for s3 bucket %s: %v", s3Bucket.KubernetesSecret, s3Bucket.ID, err)
			continue
		}

		accessKeyMap[s3Bucket.ID] = string(secret.Data["access_key_id"])
		secretKeyMap[s3Bucket.ID] = string(secret.Data["secret_key"])
	}

	return models.TransformS3BucketEntities(s3Buckets, accessKeyMap, secretKeyMap), nil
}

func (self *StorageService) getTeamS3Bucket(ctx context.Context, team *ent.Team, id uuid.UUID) (*ent.S3Bucket, error) {
	s3Bucket, err := self.repo.S3Bucket().GetByID(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "S3 bucket not found")
		}
		return nil, err
	}
	if s3Bucket.TeamID != team.ID {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "S3 bucket not found")
	}
	return s3Bucket, nil
}
