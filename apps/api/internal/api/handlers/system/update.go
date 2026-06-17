package system_handler

import (
	"context"
	"slices"
	"sort"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"golang.org/x/mod/semver"
)

const updateKey = "update-in-progress"

func (self *HandlerGroup) CheckPermissions(ctx context.Context, requesterUserID uuid.UUID) error {
	permissionChecks := []permissions_repo.PermissionCheck{
		// Team editor can create projects
		{
			Action:       schema.ActionAdmin,
			ResourceType: schema.ResourceTypeSystem,
		},
	}

	if err := self.srv.Repository.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return huma.Error403Forbidden("You are not authorized to perform this action")
	}

	return nil
}

// * Check for updates
type UpdateCheckResponse struct {
	Body struct {
		HasUpdateAvailable bool     `json:"has_update_available"`
		AvailableVersions  []string `json:"available_versions" nullable:"false"`
		CurrentVersion     string   `json:"current_version"`
	}
}

func (self *HandlerGroup) CheckForUpdates(ctx context.Context, input *server.BaseAuthInput) (*UpdateCheckResponse, error) {
	// Get requester
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}

	// Check permissions
	if err := self.CheckPermissions(ctx, user.ID); err != nil {
		return nil, err
	}

	// Get all available versions
	allUpdates, err := self.srv.UpdateManager.CheckForUpdates(ctx)
	if err != nil {
		// Log the error but return empty updates instead of error
		log.Errorf("Failed to check for updates: %v", err)
		resp := &UpdateCheckResponse{}
		resp.Body.HasUpdateAvailable = false
		resp.Body.AvailableVersions = []string{}
		resp.Body.CurrentVersion = self.srv.UpdateManager.CurrentVersion
		return resp, nil
	}

	// Filter to only show versions that can be updated to in sequence
	availableUpdates := make([]string, 0)
	currentVersion := self.srv.UpdateManager.CurrentVersion

	// Sort versions to ensure we process them in order
	sort.Slice(allUpdates, func(i, j int) bool {
		return semver.Compare(allUpdates[i], allUpdates[j]) < 0
	})

	// Filter out versions less than or equal to current version
	for _, version := range allUpdates {
		if semver.Compare(version, currentVersion) > 0 {
			availableUpdates = append(availableUpdates, version)
		}
	}

	resp := &UpdateCheckResponse{}
	resp.Body.HasUpdateAvailable = len(availableUpdates) > 0
	resp.Body.AvailableVersions = availableUpdates
	resp.Body.CurrentVersion = currentVersion

	return resp, nil
}

// * Apply update
type UpdateApplyInput struct {
	server.BaseAuthInput
	Body struct {
		TargetVersion string `json:"target_version"`
	}
}

type UpdateApplyResponse struct {
	Body struct {
		Started bool `json:"started"`
	}
}

func (self *HandlerGroup) ApplyUpdate(ctx context.Context, input *UpdateApplyInput) (*UpdateApplyResponse, error) {
	// Get requester
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}

	// Check permissions
	if err := self.CheckPermissions(ctx, user.ID); err != nil {
		return nil, err
	}

	// Get all available versions
	availableUpdates, err := self.srv.UpdateManager.CheckForUpdates(ctx)
	if err != nil {
		// Log the error but return error since this is an apply operation
		log.Errorf("Failed to check for updates: %v", err)
		return nil, huma.Error500InternalServerError("Failed to check for updates: " + err.Error())
	}

	// Validate version is in the available updates list
	if !slices.Contains(availableUpdates, input.Body.TargetVersion) {
		return nil, huma.Error400BadRequest("Target version is not available for update")
	}

	// Apply the update
	// Cache update status
	err = self.srv.StringCache.Set(ctx, updateKey, input.Body.TargetVersion)
	if err != nil {
		log.Errorf("Failed to cache update status: %v", err)
	}

	if err := self.srv.UpdateManager.UpdateToVersion(ctx, input.Body.TargetVersion); err != nil {
		log.Errorf("Failed to apply update: %v", err)
		// Clear the cache if the update fails
		err = self.srv.StringCache.Delete(ctx, updateKey)
		if err != nil {
			log.Errorf("Failed to clear cached update status: %v", err)
		}
		return nil, huma.Error500InternalServerError("Failed to apply update: " + err.Error())
	}

	resp := &UpdateApplyResponse{}
	resp.Body.Started = true

	return resp, nil
}

// * Get update status
type UpdateStatusResponse struct {
	Body struct {
		Ready bool `json:"ready"`
	}
}

func (self *HandlerGroup) GetUpdateStatus(ctx context.Context, input *server.BaseAuthInput) (*UpdateStatusResponse, error) {
	// Get requester
	user, found := self.srv.GetUserFromContext(ctx)
	if !found {
		return nil, huma.Error401Unauthorized("Unauthorized")
	}

	// Check permissions
	if err := self.CheckPermissions(ctx, user.ID); err != nil {
		return nil, err
	}

	// Get update status from cache
	cachedVersion, err := self.srv.StringCache.Get(ctx, updateKey)
	clearCache := true
	if err != nil {
		clearCache = false // Don't clear cache if we can't get it
		log.Errorf("Failed to get cached update status: %v", err)
		cachedVersion = self.srv.UpdateManager.CurrentVersion
	}
	// Get update status
	ready, err := self.srv.UpdateManager.CheckDeploymentsReady(ctx, cachedVersion)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get update status: " + err.Error())
	}

	// Check if the expected version is the same as the cached version
	if ready && clearCache {
		// Clear the cache if the update is ready
		err = self.srv.StringCache.Delete(ctx, updateKey)
		if err != nil {
			log.Errorf("Failed to clear cached update status: %v", err)
		}
	}

	resp := &UpdateStatusResponse{}
	resp.Body.Ready = ready

	return resp, nil
}
