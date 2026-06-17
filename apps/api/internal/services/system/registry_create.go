package system_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *SystemService) CreateRegistry(ctx context.Context, requesterUserID uuid.UUID, input models.CreateRegistryInput) (*models.RegistryResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionEditor,
			ResourceType: schema.ResourceTypeSystem,
		},
	}

	if err := self.repo.Permissions().Check(
		ctx,
		requesterUserID,
		permissionChecks,
	); err != nil {
		return nil, err
	}

	// Test registry
	valid, err := self.registryTester.TestRegistryCredentials(ctx, input.Host, input.Username, input.Password)
	if err != nil {
		return nil, err
	}
	if !valid {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Invalid registry credentials")
	}

	var registry *ent.Registry
	// Start transaction
	if err := self.repo.WithTx(ctx, func(tx repository.TxInterface) error {
		// Create credentials first if needed
		secretName, err := utils.GenerateSlug(input.Host)
		if err != nil {
			return fmt.Errorf("failed to generate slug for registry secret: %w", err)
		}

		// Create registry
		registry, err = self.repo.System().CreateRegistry(ctx, tx, input.Host, secretName, false)
		if err != nil {
			return fmt.Errorf("failed to create registry: %w", err)
		}

		// Get teams so we can copy secret to all teams
		teams, err := tx.Client().Team.Query().All(ctx)
		if err != nil {
			return fmt.Errorf("failed to query teams: %w", err)
		}

		// Create credentials second, so if it fails the above rolls back
		_, err = self.k8s.CreateMultiRegistryCredentials(
			ctx,
			secretName,
			self.cfg.SystemNamespace,
			[]k8s.RegistryCredential{
				{
					RegistryURL: input.Host,
					Username:    input.Username,
					Password:    input.Password,
				},
			},
			self.k8s.GetInternalClient(),
		)
		if err != nil {
			return fmt.Errorf("failed to create registry credentials: %w", err)
		}

		for _, team := range teams {
			_, err = self.k8s.CopySecret(ctx, secretName, self.cfg.SystemNamespace, team.Namespace, self.k8s.GetInternalClient())
			if err != nil {
				return fmt.Errorf("failed to copy registry credentials to team namespace: %w", err)
			}
		}

		return nil
	}); err != nil {
		return nil, fmt.Errorf("failed to bootstrap registry: %w", err)
	}

	return models.TransformRegistryEntity(registry, input.Username), nil
}
