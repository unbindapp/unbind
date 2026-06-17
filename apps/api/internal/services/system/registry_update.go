package system_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *SystemService) SetDefaultRegistry(ctx context.Context, requesterUserID uuid.UUID, input models.SetDefaultRegistryInput) (*models.RegistryResponse, error) {
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

	registry, err := self.repo.System().SetDefaultRegistry(ctx, input.ID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Registry not found")
		}
		return nil, err
	}

	// Get the registry username
	registryCredentials, err := self.k8s.GetSecret(ctx, registry.KubernetesSecret, self.cfg.SystemNamespace, self.k8s.GetInternalClient())
	if err != nil {
		return nil, err
	}
	username, _, err := self.k8s.ParseRegistryCredentials(registryCredentials)
	if err != nil {
		return nil, err
	}

	return models.TransformRegistryEntity(registry, username), nil
}
