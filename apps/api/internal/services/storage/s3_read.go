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

// Get a specific storage backend by ID
func (self *StorageService) GetS3StorageByID(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, teamID, id uuid.UUID, withBuckets bool) (*models.S3Response, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Team viewer can view s3 sources
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   teamID,
		},
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Check if the team exists
	team, err := self.repo.Team().GetByID(ctx, teamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, err
	}

	// Get all s3 sources for this team
	s3Source, err := self.repo.S3().GetByID(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "S3 source not found")
		}
		return nil, err
	}
	if s3Source.TeamID != team.ID {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "S3 source not found")
	}

	// Create kubernetes client
	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}

	// Get the secret
	secret, err := self.k8s.GetSecret(ctx, s3Source.KubernetesSecret, team.Namespace, client)
	if err != nil {
		log.Errorf("Failed to get secret %s for s3 %s: %v", s3Source.KubernetesSecret, s3Source.ID, err)
		return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Secret not found")
	}

	accessKey := string(secret.Data["access_key_id"])
	secretKey := string(secret.Data["secret_key"])
	buckets := []*models.S3Bucket{}

	if withBuckets {
		s3client, err := s3.NewS3Client(
			ctx,
			s3Source.Endpoint,
			s3Source.Region,
			accessKey,
			secretKey,
		)
		if err != nil {
			log.Errorf("Failed to create S3 client for %s: %v", s3Source.ID, err)
			return nil, err
		}
		buckets, err = s3client.ListBuckets(ctx)
		if err != nil {
			log.Errorf("Failed to list buckets for S3 source %s: %v", s3Source.ID, err)
			return nil, err
		}
	}

	return models.TransformS3Entity(s3Source, accessKey, secretKey, buckets), nil
}

// ListS3StorageBackends lists all S3 storage backends for a given team.
func (self *StorageService) ListS3StorageBackends(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, teamID uuid.UUID, withBuckets bool) ([]*models.S3Response, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Team viewer can view s3 sources
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   teamID,
		},
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Check if the team exists
	team, err := self.repo.Team().GetByID(ctx, teamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, err
	}

	// Get all s3 sources for this team
	s3Sources, err := self.repo.S3().GetByTeam(ctx, team.ID)
	if err != nil {
		return nil, err
	}
	if len(s3Sources) == 0 {
		return []*models.S3Response{}, nil
	}

	// Create kubernetes client
	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}

	// Create credential map
	accessKeyMap := make(map[uuid.UUID]string)
	secretKeyMap := make(map[uuid.UUID]string)
	bucketsMap := make(map[uuid.UUID][]*models.S3Bucket)
	for _, s3Source := range s3Sources {
		// Get the secret
		secret, err := self.k8s.GetSecret(ctx, s3Source.KubernetesSecret, team.Namespace, client)
		if err != nil {
			log.Errorf("Failed to get secret %s for s3 %s: %v", s3Source.KubernetesSecret, s3Source.ID, err)
			continue
		}

		accessKeyMap[s3Source.ID] = string(secret.Data["access_key_id"])
		secretKeyMap[s3Source.ID] = string(secret.Data["secret_key"])

		if withBuckets {
			s3client, err := s3.NewS3Client(
				ctx,
				s3Source.Endpoint,
				s3Source.Region,
				accessKeyMap[s3Source.ID],
				secretKeyMap[s3Source.ID],
			)
			if err != nil {
				log.Errorf("Failed to create S3 client for %s: %v", s3Source.ID, err)
				return nil, err
			}
			buckets, err := s3client.ListBuckets(ctx)
			if err != nil {
				log.Errorf("Failed to list buckets for S3 source %s: %v", s3Source.ID, err)
				return nil, err
			}
			bucketsMap[s3Source.ID] = buckets
		}
	}

	return models.TransformS3Entities(s3Sources, accessKeyMap, secretKeyMap, bucketsMap), nil
}
