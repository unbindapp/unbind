package storage_service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/infrastructure/s3"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// Delete a specific storage backend by ID
func (self *StorageService) UpdateS3Storage(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, teamID, id uuid.UUID, name, accessKeyID, secretKey *string) (*models.S3Response, error) {
	// Input validation
	if name == nil && accessKeyID == nil && secretKey == nil {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "At least one field must be provided")
	}

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

	// Update secret
	if accessKeyID != nil || secretKey != nil {
		// Create kubernetes client
		client, err := self.k8s.CreateClientWithToken(bearerToken)
		if err != nil {
			return nil, err
		}

		// Create secret for this project
		secret, _, err := self.k8s.GetOrCreateSecret(ctx, s3Source.KubernetesSecret, team.Namespace, client)
		if err != nil {
			return nil, err
		}

		// Update data
		if accessKeyID != nil {
			secret.Data["access_key_id"] = []byte(*accessKeyID)
		}
		if secretKey != nil {
			secret.Data["secret_key"] = []byte(*secretKey)
		}

		// Aws config style
		profile := "default"
		region := strings.TrimSpace(s3Source.Region)

		if accessKeyID != nil || secretKey != nil {
			// Build INI-formatted that is sometimes what stuff wants (like mysql operator)
			credentialsFile := fmt.Sprintf(`[%s]
aws_access_key_id = %s
aws_secret_access_key = %s
`, profile, string(secret.Data["access_key_id"]), string(secret.Data["secret_key"]))

			configFile := fmt.Sprintf(`[%s]
region = %s
output = json
`, profile, region)

			secret.Data["credentials"] = []byte(credentialsFile)
			secret.Data["config"] = []byte(configFile)
		}

		// Test connectivity to the S3 backend
		s3Client, err := s3.NewS3Client(
			ctx,
			s3Source.Endpoint,
			s3Source.Region,
			string(secret.Data["access_key_id"]),
			string(secret.Data["secret_key"]),
		)
		if err != nil {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
		}

		// Probe any bucket
		err = s3Client.ProbeAnyBucketRW(ctx)
		if err != nil {
			// May be invalid credentials, etc.
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
		}

		// Update the secret
		if _, err := self.k8s.UpdateSecret(ctx, secret.Name, team.Namespace, secret.Data, client); err != nil {
			return nil, err
		}
	}

	// Update name
	if name != nil {
		s3Source, err = self.repo.S3().Update(ctx, id, *name)
		if err != nil {
			return nil, err
		}
	}

	return models.TransformS3Entity(s3Source, "", "", nil), nil
}
