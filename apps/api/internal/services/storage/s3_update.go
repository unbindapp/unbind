package storage_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	s3bucket_repo "github.com/unbindapp/unbind-api/internal/repositories/s3bucket"
)

func (self *StorageService) UpdateS3Bucket(ctx context.Context, requesterUserID uuid.UUID, input *models.S3BucketUpdateInput) (*models.S3BucketResponse, error) {
	if !input.HasChanges() {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "At least one field must be provided")
	}

	permissionChecks := []permissions_repo.PermissionCheck{
		// Team editor can update s3 buckets
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   input.TeamID,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	team, err := self.repo.Team().GetByID(ctx, input.TeamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, err
	}

	s3Bucket, err := self.getTeamS3Bucket(ctx, team, input.ID)
	if err != nil {
		return nil, err
	}

	client := self.k8s.GetInternalClient()

	secret, err := self.k8s.GetSecret(ctx, s3Bucket.KubernetesSecret, team.Namespace, client)
	if err != nil {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Secret not found")
	}

	conn := s3Connection{
		Endpoint:    valueOr(input.Endpoint, s3Bucket.Endpoint),
		Region:      valueOr(input.Region, s3Bucket.Region),
		Bucket:      valueOr(input.Bucket, s3Bucket.Bucket),
		AccessKeyID: valueOr(input.AccessKeyID, string(secret.Data["access_key_id"])),
		SecretKey:   valueOr(input.SecretKey, string(secret.Data["secret_key"])),
	}

	if input.ConnectionChanged() {
		if err := probeS3Bucket(ctx, conn); err != nil {
			return nil, err
		}

		if _, err := self.k8s.OverwriteSecretValues(ctx, secret.Name, team.Namespace, s3SecretValues(conn), client); err != nil {
			return nil, err
		}
	}

	if input.Name != nil || input.Endpoint != nil || input.Region != nil || input.Bucket != nil {
		s3Bucket, err = self.repo.S3Bucket().Update(ctx, input.ID, &s3bucket_repo.UpdateS3BucketInput{
			Name:     input.Name,
			Endpoint: input.Endpoint,
			Region:   input.Region,
			Bucket:   input.Bucket,
		})
		if err != nil {
			return nil, err
		}
	}

	return models.TransformS3BucketEntity(s3Bucket, conn.AccessKeyID, conn.SecretKey), nil
}

func valueOr(value *string, fallback string) string {
	if value == nil {
		return fallback
	}
	return *value
}
