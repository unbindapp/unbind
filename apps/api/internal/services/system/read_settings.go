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

type SystemSettingsUpdateInput struct {
	WildcardDomain   *string                  `json:"wildcard_domain" required:"false" doc:"Wildcard domain for the system, an empty string clears it"`
	BuildkitSettings *schema.BuildkitSettings `json:"buildkit_settings" required:"false" doc:"Buildkit settings"`
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

	settings, err := self.repo.System().GetSystemSettings(ctx, nil)
	if err != nil {
		log.Errorf("Failed to get system settings from DB: %v", err)
		return nil, err
	}
	return &SystemSettingsResponse{
		WildcardDomain:    settings.WildcardBaseURL,
		BuildkitSettings:  settings.BuildkitSettings,
		CanUpdateBuildkit: self.canUpdateBuildkit(ctx),
	}, nil
}

// UpdateSettings updates the system settings in the database and kubernetes
func (self *SystemService) UpdateSettings(ctx context.Context, requesterUserID uuid.UUID, input *SystemSettingsUpdateInput) (*SystemSettingsResponse, error) {
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

	canUpdateBuildkit := self.canUpdateBuildkit(ctx)
	if input.BuildkitSettings != nil {
		if !canUpdateBuildkit {
			return nil, errdefs.NewCustomError(
				errdefs.ErrTypeInvalidInput,
				"Buildkit settings cannot be updated",
			)
		}
		if err := self.applyBuildkitSettings(ctx, input.BuildkitSettings); err != nil {
			return nil, err
		}
	}

	updatedSettings, err := self.repo.System().UpdateSystemSettings(ctx, &system_repo.SystemSettingUpdateInput{
		WildcardDomain:   input.WildcardDomain,
		BuildkitSettings: input.BuildkitSettings,
	})
	if err != nil {
		log.Errorf("Failed to update system settings in DB: %v", err)
		return nil, err
	}
	return &SystemSettingsResponse{
		WildcardDomain:    updatedSettings.WildcardBaseURL,
		BuildkitSettings:  updatedSettings.BuildkitSettings,
		CanUpdateBuildkit: canUpdateBuildkit,
	}, nil
}

func (self *SystemService) canUpdateBuildkit(ctx context.Context) bool {
	_, err := self.buildkitManager.GetBuildkitConfig(ctx)
	return err == nil
}

func (self *SystemService) applyBuildkitSettings(ctx context.Context, settings *schema.BuildkitSettings) error {
	if err := self.buildkitManager.UpdateMaxParallelism(ctx, settings.MaxParallelism); err != nil {
		log.Errorf("Failed to update buildkit settings in kubernetes: %v", err)
		return err
	}
	if err := self.buildkitManager.UpdateReplicas(ctx, settings.Replicas); err != nil {
		log.Errorf("Failed to update buildkit settings in kubernetes: %v", err)
		return err
	}
	if err := self.buildkitManager.RestartBuildkitdPods(ctx); err != nil {
		log.Warnf("Failed to restart buildkitd pods: %v", err)
	}
	return nil
}
