package storage_service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/infrastructure/s3"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *StorageService) CreateS3StorageBackend(ctx context.Context, requesterUserID uuid.UUID, bearerToken string, input *models.S3BackendCreateInput) (*models.S3Response, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Team editor can create s3 sources
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   input.TeamID,
		},
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Check if the team exists
	team, err := self.repo.Team().GetByID(ctx, input.TeamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, err
	}

	// Test connectivity to the S3 backend
	s3Client, err := s3.NewS3Client(
		ctx,
		input.Endpoint,
		input.Region,
		input.AccessKeyID,
		input.SecretKey,
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

	// Create kubernetes client
	client, err := self.k8s.CreateClientWithToken(bearerToken)
	if err != nil {
		return nil, err
	}

	// Store our credentials
	var s3 *ent.S3
	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		// Create a unique name
		kubernetesName, err := utils.GenerateSlug(fmt.Sprintf("s3-%s", input.Name))
		if err != nil {
			log.Errorf("Failed to generate kubernetes name for S3 source %s: %v", input.Name, err)
			return err
		}

		// Create secret for this project
		secret, _, err := self.k8s.GetOrCreateSecret(ctx, kubernetesName, team.Namespace, client)
		if err != nil {
			return err
		}

		// Store the credentials in the secret
		// Aws config style
		profile := "default"
		region := strings.TrimSpace(input.Region)

		// Build INI-formatted that is sometimes what stuff wants (like mysql operator)
		credentialsFile := fmt.Sprintf(`[%s]
aws_access_key_id = %s
aws_secret_access_key = %s
`, profile, input.AccessKeyID, input.SecretKey)

		configFile := fmt.Sprintf(`[%s]
region = %s
output = json
`, profile, region)

		values := map[string][]byte{
			"access_key_id": []byte(input.AccessKeyID),
			"secret_key":    []byte(input.SecretKey),
			"credentials":   []byte(credentialsFile),
			"config":        []byte(configFile),
		}
		_, err = self.k8s.OverwriteSecretValues(ctx, secret.Name, team.Namespace, values, client)
		if err != nil {
			return err
		}

		s3, err = self.repo.S3().Create(ctx, tx, input.TeamID, input.Name, input.Endpoint, input.Region, secret.Name)
		if err != nil {
			return err
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return models.TransformS3Entity(s3, input.AccessKeyID, input.SecretKey, nil), nil
}
