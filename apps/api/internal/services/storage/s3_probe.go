package storage_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/infrastructure/s3"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// Credentials that are not stored yet, so they come from the caller
func (self *StorageService) TestS3Access(ctx context.Context, requesterUserID uuid.UUID, input *models.S3AccessTestInput) (*models.S3TestResult, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Team editor can create s3 buckets, so it can test one before creating it
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   input.TeamID,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	return testS3Connection(ctx, s3Connection{
		Endpoint:    input.Endpoint,
		Region:      input.Region,
		Bucket:      input.Bucket,
		AccessKeyID: input.AccessKeyID,
		SecretKey:   input.SecretKey,
	}), nil
}

func (self *StorageService) TestStoredS3Bucket(ctx context.Context, requesterUserID uuid.UUID, teamID, id uuid.UUID) (*models.S3TestResult, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Team viewer can view s3 buckets and their connection status
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

	return testS3Connection(ctx, s3Connection{
		Endpoint:    s3Bucket.Endpoint,
		Region:      s3Bucket.Region,
		Bucket:      s3Bucket.Bucket,
		AccessKeyID: string(secret.Data["access_key_id"]),
		SecretKey:   string(secret.Data["secret_key"]),
	}), nil
}

func testS3Connection(ctx context.Context, conn s3Connection) *models.S3TestResult {
	s3Client, err := s3.NewS3Client(ctx, conn.Endpoint, conn.Region, conn.AccessKeyID, conn.SecretKey)
	if err != nil {
		return &models.S3TestResult{Valid: false, Error: err.Error()}
	}
	if err := s3Client.ProbeBucketRW(ctx, conn.Bucket); err != nil {
		return &models.S3TestResult{Valid: false, Error: err.Error()}
	}
	return &models.S3TestResult{Valid: true}
}
