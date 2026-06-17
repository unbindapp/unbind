package system_repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/registry"
	repository "github.com/unbindapp/unbind-api/internal/repositories"
)

func (self *SystemRepository) CreateRegistry(ctx context.Context, tx repository.TxInterface, host string, kubernetesSecret string, isDefault bool) (*ent.Registry, error) {
	db := self.base.DB
	if tx != nil {
		db = tx.Client()
	}
	// Create registry
	return db.Registry.Create().
		SetHost(host).
		SetKubernetesSecret(kubernetesSecret).
		SetIsDefault(isDefault).
		Save(ctx)
}

func (self *SystemRepository) GetDefaultRegistry(ctx context.Context) (*ent.Registry, error) {
	// Get default registry
	return self.base.DB.Registry.Query().
		Where(registry.IsDefault(true)).
		Order(
			ent.Desc(registry.FieldCreatedAt),
		).
		First(ctx)
}

func (self *SystemRepository) SetDefaultRegistry(ctx context.Context, id uuid.UUID) (*ent.Registry, error) {
	var registry *ent.Registry
	var err error
	if err := self.base.WithTx(ctx, func(tx repository.TxInterface) error {
		err = tx.Client().Registry.Update().
			SetIsDefault(false).
			Exec(ctx)
		if err != nil {
			return err
		}

		registry, err = tx.Client().Registry.UpdateOneID(id).
			SetIsDefault(true).
			Save(ctx)
		return err
	}); err != nil {
		return nil, err
	}
	return registry, nil
}

func (self *SystemRepository) GetImagePullSecrets(ctx context.Context) ([]string, error) {
	// Get all registries
	registries, err := self.base.DB.Registry.Query().
		Select(registry.FieldKubernetesSecret).
		All(ctx)
	if err != nil {
		return nil, err
	}

	imagePullSecrets := make([]string, len(registries))
	for i, registry := range registries {
		imagePullSecrets[i] = registry.KubernetesSecret
	}
	return imagePullSecrets, nil
}

func (self *SystemRepository) GetRegistry(ctx context.Context, id uuid.UUID) (*ent.Registry, error) {
	// Get registry
	return self.base.DB.Registry.Get(ctx, id)
}

func (self *SystemRepository) GetAllRegistries(ctx context.Context) ([]*ent.Registry, error) {
	// Get all registries
	return self.base.DB.Registry.Query().
		Order(
			ent.Desc(registry.FieldCreatedAt),
		).
		All(ctx)
}

func (self *SystemRepository) DeleteRegistry(ctx context.Context, id uuid.UUID) error {
	// Delete registry
	return self.base.DB.Registry.DeleteOneID(id).Exec(ctx)
}
