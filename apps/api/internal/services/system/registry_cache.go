package system_service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	system_repo "github.com/unbindapp/unbind-api/internal/repositories/system"
)

const bytesPerGB = 1024 * 1024 * 1024

func (self *SystemService) checkRegistryCachePermission(ctx context.Context, requesterUserID uuid.UUID, action schema.PermittedAction) error {
	return self.repo.Permissions().Check(ctx, requesterUserID, []permissions_repo.PermissionCheck{
		{
			Action:       action,
			ResourceType: schema.ResourceTypeSystem,
		},
	})
}

// GetRegistryCacheConfig returns the current registry cache configuration.
func (self *SystemService) GetRegistryCacheConfig(ctx context.Context, requesterUserID uuid.UUID) (*models.RegistryCacheConfig, error) {
	if err := self.checkRegistryCachePermission(ctx, requesterUserID, schema.ActionViewer); err != nil {
		return nil, err
	}

	if !self.registryCacheManager.IsManaged(ctx) {
		return &models.RegistryCacheConfig{Managed: false}, nil
	}

	cfg := &models.RegistryCacheConfig{Managed: true}

	if threshold, err := self.registryCacheManager.GetThreshold(ctx); err == nil {
		if qty, err := utils.ValidateStorageQuantity(threshold); err == nil {
			cfg.CleanupThresholdGB = float64(qty.Value()) / bytesPerGB
		}
	}

	if schedule, err := self.registryCacheManager.GetSchedule(ctx); err == nil {
		cfg.CleanupSchedule = schedule
	}

	if pvc, err := self.registryCacheManager.GetPVC(ctx); err == nil {
		cfg.PVCCapacityGB = float64(pvc.EffectiveBytes()) / bytesPerGB
		cfg.StorageClass = pvc.StorageClass
		cfg.CanExpand = pvc.CanExpand
	} else {
		log.Warnf("registry cache: failed to read pvc: %v", err)
	}

	if storage, err := self.k8s.AvailableStorageBytes(ctx); err == nil {
		cfg.MinimumStorageGB = storage.MinimumStorageGB
		cfg.MaximumStorageGB = storage.MaximumStorageGB
		cfg.StorageStepGB = storage.StorageStepGB
	}

	return cfg, nil
}

// GetRegistryCacheStats returns current registry usage and last cleanup status.
func (self *SystemService) GetRegistryCacheStats(ctx context.Context, requesterUserID uuid.UUID) (*models.RegistryCacheStats, error) {
	if err := self.checkRegistryCachePermission(ctx, requesterUserID, schema.ActionViewer); err != nil {
		return nil, err
	}

	if !self.registryCacheManager.IsManaged(ctx) {
		return &models.RegistryCacheStats{Managed: false}, nil
	}

	stats := &models.RegistryCacheStats{Managed: true}

	usage, err := self.registryCacheManager.GetUsage(ctx)
	if err != nil {
		log.Errorf("registry cache: failed to compute usage: %v", err)
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Failed to read registry usage")
	}
	stats.UsedBytes = usage.UsedBytes
	stats.RepositoryCount = usage.RepositoryCount
	stats.TagCount = usage.TagCount

	if pvc, err := self.registryCacheManager.GetPVC(ctx); err == nil {
		stats.PVCCapacityGB = float64(pvc.EffectiveBytes()) / bytesPerGB
	}

	if threshold, err := self.registryCacheManager.GetThreshold(ctx); err == nil {
		if qty, err := utils.ValidateStorageQuantity(threshold); err == nil {
			stats.ThresholdGB = float64(qty.Value()) / bytesPerGB
		}
	}

	if run, err := self.registryCacheManager.GetLastCleanup(ctx); err == nil {
		stats.LastCleanup = run
	} else {
		log.Warnf("registry cache: failed to read last cleanup: %v", err)
	}

	return stats, nil
}

// UpdateRegistryCache persists the desired cache config and applies it to
// kubernetes. PVC capacity may only grow.
func (self *SystemService) UpdateRegistryCache(ctx context.Context, requesterUserID uuid.UUID, input *models.UpdateRegistryCacheInput) (*models.RegistryCacheConfig, error) {
	if err := self.checkRegistryCachePermission(ctx, requesterUserID, schema.ActionEditor); err != nil {
		return nil, err
	}

	if !self.registryCacheManager.IsManaged(ctx) {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Registry cache is externally managed and cannot be configured")
	}

	var thresholdStr *string
	if input.CleanupThresholdGB != nil {
		if _, err := utils.ValidateStorageQuantityGB(*input.CleanupThresholdGB); err != nil {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
		}
		thresholdStr = utils.ToPtr(fmt.Sprintf("%.2fGi", *input.CleanupThresholdGB))
	}

	if input.CleanupSchedule != nil && *input.CleanupSchedule == "" {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Schedule cannot be empty")
	}

	// Grow-only PVC validation
	if input.PVCCapacityGB != nil {
		newQty, err := utils.ValidateStorageQuantityGB(*input.PVCCapacityGB)
		if err != nil {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, err.Error())
		}
		pvc, err := self.registryCacheManager.GetPVC(ctx)
		if err != nil {
			return nil, err
		}
		if !pvc.CanExpand {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "Storage class does not support volume expansion")
		}
		existingQty, err := utils.ValidateStorageQuantity(fmt.Sprintf("%d", pvc.EffectiveBytes()))
		if err != nil {
			return nil, err
		}
		if newQty.Cmp(existingQty) < 0 {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "New volume size must be greater than the current size")
		}
		if err := self.registryCacheManager.UpdatePVCCapacity(ctx, newQty.String()); err != nil {
			return nil, err
		}
	}

	if thresholdStr != nil || input.CleanupSchedule != nil {
		if err := self.registryCacheManager.Apply(ctx, thresholdStr, input.CleanupSchedule); err != nil {
			return nil, err
		}
	}

	// Persist desired state so it can be reconciled after helm upgrades
	if err := self.persistRegistryCacheSettings(ctx, input); err != nil {
		log.Errorf("registry cache: failed to persist settings: %v", err)
	}

	return self.GetRegistryCacheConfig(ctx, requesterUserID)
}

func (self *SystemService) persistRegistryCacheSettings(ctx context.Context, input *models.UpdateRegistryCacheInput) error {
	current, err := self.repo.System().GetSystemSettings(ctx, nil)
	settings := &schema.RegistryCacheSettings{}
	if err == nil && current.RegistryCacheSettings != nil {
		settings = current.RegistryCacheSettings
	}

	if input.CleanupThresholdGB != nil {
		settings.CleanupThresholdGB = *input.CleanupThresholdGB
	}
	if input.CleanupSchedule != nil {
		settings.CleanupSchedule = *input.CleanupSchedule
	}

	_, err = self.repo.System().UpdateSystemSettings(ctx, &system_repo.SystemSettingUpdateInput{
		RegistryCacheSettings: settings,
	})
	return err
}

// ReconcileRegistryCache re-applies persisted cache settings to kubernetes,
// used at startup so admin changes survive helm upgrades.
func (self *SystemService) ReconcileRegistryCache(ctx context.Context) {
	if !self.registryCacheManager.IsManaged(ctx) {
		return
	}
	settings, err := self.repo.System().GetSystemSettings(ctx, nil)
	if err != nil || settings.RegistryCacheSettings == nil {
		return
	}

	var thresholdStr *string
	if settings.RegistryCacheSettings.CleanupThresholdGB > 0 {
		thresholdStr = utils.ToPtr(fmt.Sprintf("%.2fGi", settings.RegistryCacheSettings.CleanupThresholdGB))
	}
	var schedule *string
	if settings.RegistryCacheSettings.CleanupSchedule != "" {
		schedule = utils.ToPtr(settings.RegistryCacheSettings.CleanupSchedule)
	}
	if thresholdStr == nil && schedule == nil {
		return
	}
	if err := self.registryCacheManager.Apply(ctx, thresholdStr, schedule); err != nil {
		log.Warnf("registry cache: reconcile failed: %v", err)
	}
}
