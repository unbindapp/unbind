package storage_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	s3bucket_repo "github.com/unbindapp/unbind-api/internal/repositories/s3bucket"
)

func (self *StorageService) CreateS3Bucket(ctx context.Context, requesterUserID uuid.UUID, input *models.S3BucketCreateInput) (*models.S3BucketResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Team editor can create s3 buckets
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

	conn := s3Connection{
		Endpoint:    input.Endpoint,
		Region:      input.Region,
		Bucket:      input.Bucket,
		AccessKeyID: input.AccessKeyID,
		SecretKey:   input.SecretKey,
	}
	if err := probeS3Bucket(ctx, conn); err != nil {
		return nil, err
	}

	client := self.k8s.GetInternalClient()

	var s3Bucket *ent.S3Bucket
	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		kubernetesName, err := utils.GenerateSlug(fmt.Sprintf("s3-%s", input.Name))
		if err != nil {
			log.Errorf("Failed to generate kubernetes name for S3 bucket %s: %v", input.Name, err)
			return err
		}

		secret, _, err := self.k8s.GetOrCreateSecret(ctx, kubernetesName, team.Namespace, client)
		if err != nil {
			return err
		}

		_, err = self.k8s.OverwriteSecretValues(ctx, secret.Name, team.Namespace, s3SecretValues(conn), client)
		if err != nil {
			return err
		}

		s3Bucket, err = self.repo.S3Bucket().Create(ctx, tx, &s3bucket_repo.CreateS3BucketInput{
			TeamID:           input.TeamID,
			Name:             input.Name,
			Endpoint:         input.Endpoint,
			Region:           input.Region,
			Bucket:           input.Bucket,
			KubernetesSecret: secret.Name,
		})
		return err
	}); err != nil {
		return nil, err
	}

	return models.TransformS3BucketEntity(s3Bucket, input.AccessKeyID, input.SecretKey), nil
}
