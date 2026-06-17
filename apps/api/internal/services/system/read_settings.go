package system_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	system_repo "github.com/unbindapp/unbind-api/internal/repositories/system"
)

type SystemSettingsResponse struct {
	WildcardDomain    *string                  `json:"wildcard_domain,omitempty" required:"false"`
	BuildkitSettings  *schema.BuildkitSettings `json:"buildkit_settings,omitempty" required:"false"`
	CanUpdateBuildkit bool                     `json:"can_update_buildkit" doc:"If not externally managed, this indicates if the user can update buildkit settings"`
}

func (self *SystemService) GetSettings(ctx context.Context, requesterUserID uuid.UUID) (*SystemSettingsResponse, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionViewer,
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

	// Get from system
	canUpdateBuildkit := false
	_, err := self.buildkitManager.GetBuildkitConfig(ctx)
	canUpdateBuildkit = err == nil

	settings, err := self.repo.System().GetSystemSettings(ctx, nil)
	if err != nil {
		log.Errorf("Failed to get buildkit settings from DB: %v", err)
		return nil, err
	}
	return &SystemSettingsResponse{
		WildcardDomain:    settings.WildcardBaseURL,
		BuildkitSettings:  settings.BuildkitSettings,
		CanUpdateBuildkit: canUpdateBuildkit,
	}, nil
}

// UpdateSettings updates the system settings in the database and kubernetes
func (self *SystemService) UpdateSettings(ctx context.Context, requesterUserID uuid.UUID, input *system_repo.SystemSettingUpdateInput) (*SystemSettingsResponse, error) {
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

	if input.BuildkitSettings != nil {
		canUpdateBuildkit := false
		_, err := self.buildkitManager.GetBuildkitConfig(ctx)
		canUpdateBuildkit = err == nil

		if !canUpdateBuildkit {
			return nil, errdefs.NewCustomError(
				errdefs.ErrTypeInvalidInput,
				"Buildkit settings cannot be updated",
			)
		}

		err = self.buildkitManager.UpdateMaxParallelism(ctx, input.BuildkitSettings.MaxParallelism)
		if err != nil {
			log.Errorf("Failed to update buildkit settings in kubernetes: %v", err)
			return nil, err
		}
		err = self.buildkitManager.UpdateReplicas(ctx, input.BuildkitSettings.Replicas)
		if err != nil {
			log.Errorf("Failed to update buildkit settings in kubernetes: %v", err)
			return nil, err
		}
		err = self.buildkitManager.RestartBuildkitdPods(ctx)
		if err != nil {
			log.Warnf("Failed to restart buildkitd pods: %v", err)
		}
	}

	updatedSettings, err := self.repo.System().UpdateSystemSettings(ctx, &system_repo.SystemSettingUpdateInput{
		WildcardDomain:   input.WildcardDomain,
		BuildkitSettings: input.BuildkitSettings,
	})
	if err != nil {
		log.Errorf("Failed to update buildkit settings in DB: %v", err)
		return nil, err
	}
	return &SystemSettingsResponse{
		WildcardDomain:   updatedSettings.WildcardBaseURL,
		BuildkitSettings: updatedSettings.BuildkitSettings,
	}, nil
}
