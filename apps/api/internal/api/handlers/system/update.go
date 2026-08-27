package system_handler

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/api/server"
	"github.com/unbindapp/unbind-api/internal/common/log"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
	"github.com/unbindapp/unbind-api/pkg/release"
)

const updateKey = "update-in-progress"

// updateStateTTL bounds how long a stale state can pin the system in "updating"
// if an update wedges without ever reporting completion or failure.
const updateStateTTL = 30 * time.Minute

type updateState struct {
	TargetVersion string `json:"target_version"`
	Failed        bool   `json:"failed,omitempty"`
	Message       string `json:"message,omitempty"`
}

func (self *HandlerGroup) getUpdateState(ctx context.Context) (*updateState, error) {
	raw, err := self.srv.StringCache.Get(ctx, updateKey)
	if err != nil {
		return nil, err
	}

	var state updateState
	if err := json.Unmarshal([]byte(raw), &state); err != nil || state.TargetVersion == "" {
		// Older versions stored the bare target version string.
		return &updateState{TargetVersion: raw}, nil
	}
	return &state, nil
}

func (self *HandlerGroup) setUpdateState(ctx context.Context, state *updateState) error {
	encoded, err := json.Marshal(state)
	if err != nil {
		return err
	}
	return self.srv.StringCache.SetWithExpiration(ctx, updateKey, string(encoded), updateStateTTL)
}

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

type AvailableVersion struct {
	Version      string `json:"version"`
	URL          string `json:"url"`
	Description  string `json:"description,omitempty"`
	ReleaseNotes string `json:"release_notes,omitempty"`
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
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if err := self.CheckPermissions(ctx, user.ID); err != nil {
		return nil, err
	}

	if state, err := self.getUpdateState(ctx); err == nil && !state.Failed {
		ready, err := self.srv.UpdateManager.CheckUpdateComplete(ctx, state.TargetVersion)
		if err != nil || !ready {
			return nil, huma.Error409Conflict("An update is already in progress")
		}
		// The previous update finished but its state was never polled away.
		if err := self.srv.StringCache.Delete(ctx, updateKey); err != nil {
			log.Errorf("Failed to clear completed update state: %v", err)
		}
	} else if err != nil && !errors.Is(err, redis.Nil) {
		log.Errorf("Failed to read update state: %v", err)
	}

	availableUpdates, err := self.srv.UpdateManager.CheckForUpdates(ctx)
	if err != nil {
		// Log the error but return error since this is an apply operation
		log.Errorf("Failed to check for updates: %v", err)
		return nil, huma.Error500InternalServerError("Failed to check for updates: " + err.Error())
	}

	// Validate version is in the available updates list
	if !slices.ContainsFunc(availableUpdates, func(update release.VersionMetadata) bool {
		return update.Version == input.Body.TargetVersion
	}) {
		return nil, huma.Error400BadRequest("Target version is not available for update")
	}

	targetVersion := input.Body.TargetVersion

	// Refuse to start an update we can't track; the status endpoint would have no
	// target to check against.
	if err := self.setUpdateState(ctx, &updateState{TargetVersion: targetVersion}); err != nil {
		log.Errorf("Failed to record update target: %v", err)
		return nil, huma.Error500InternalServerError("Failed to record update target: " + err.Error())
	}

	// Run the update detached from the request so closing the page can't abort it
	// half-applied; the status endpoint is the source of truth from here on.
	bgCtx := context.WithoutCancel(ctx)
	go func() {
		updateCtx, cancel := context.WithTimeout(bgCtx, updateStateTTL)
		defer cancel()

		if err := self.srv.UpdateManager.UpdateToVersion(updateCtx, targetVersion); err != nil {
			log.Errorf("Failed to apply update to %s: %v", targetVersion, err)
			failed := &updateState{TargetVersion: targetVersion, Failed: true, Message: err.Error()}
			if err := self.setUpdateState(bgCtx, failed); err != nil {
				log.Errorf("Failed to record update failure: %v", err)
			}
		}
	}()

	resp := &UpdateApplyResponse{}
	resp.Body.Started = true

	return resp, nil
}

// * Get update status
type UpdateStatusResponse struct {
	Body struct {
		HasUpdateAvailable bool               `json:"has_update_available"`
		AvailableVersions  []AvailableVersion `json:"available_versions" nullable:"false"`
		CurrentVersion     string             `json:"current_version"`
		CurrentVersionURL  string             `json:"current_version_url"`
		InProgress         bool               `json:"in_progress"`
		Failed             bool               `json:"failed"`
		// Ready is only ever true when the binary serving this request already runs
		// the version being checked, so clients can trust current_version with it.
		Ready         bool   `json:"ready"`
		TargetVersion string `json:"target_version,omitempty"`
		Message       string `json:"message,omitempty"`
	}
}

func (self *HandlerGroup) GetUpdateStatus(ctx context.Context, input *server.BaseAuthInput) (*UpdateStatusResponse, error) {
	user, _, err := self.srv.AuthenticatedUser(ctx)
	if err != nil {
		return nil, err
	}

	if err := self.CheckPermissions(ctx, user.ID); err != nil {
		return nil, err
	}

	resp := &UpdateStatusResponse{}
	resp.Body.CurrentVersion = self.srv.UpdateManager.CurrentVersion
	resp.Body.CurrentVersionURL = self.srv.UpdateManager.ReleaseURL(self.srv.UpdateManager.CurrentVersion)
	resp.Body.AvailableVersions = []AvailableVersion{}

	// The release list is best-effort: an unreachable GitHub must not hide the
	// state of an update that is already running.
	allUpdates, err := self.srv.UpdateManager.CheckForUpdates(ctx)
	if err != nil {
		log.Errorf("Failed to check for updates: %v", err)
	}
	// The update manager already returns newer-than-current versions, oldest first.
	for _, update := range allUpdates {
		resp.Body.AvailableVersions = append(resp.Body.AvailableVersions, AvailableVersion{
			Version:      update.Version,
			URL:          self.srv.UpdateManager.ReleaseURL(update.Version),
			Description:  update.Description,
			ReleaseNotes: update.ReleaseNotes,
		})
	}
	resp.Body.HasUpdateAvailable = len(resp.Body.AvailableVersions) > 0

	state, err := self.getUpdateState(ctx)
	if err != nil && !errors.Is(err, redis.Nil) {
		log.Errorf("Failed to get update state: %v", err)
	}

	if state != nil && state.Failed {
		resp.Body.Failed = true
		resp.Body.TargetVersion = state.TargetVersion
		resp.Body.Message = state.Message
		return resp, nil
	}

	// With no update in progress, report whether the cluster matches this binary.
	targetVersion := self.srv.UpdateManager.CurrentVersion
	updateInProgress := state != nil
	if state != nil {
		targetVersion = state.TargetVersion
	}

	ready, err := self.srv.UpdateManager.CheckUpdateComplete(ctx, targetVersion)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to get update status: " + err.Error())
	}

	if ready && updateInProgress {
		if err := self.srv.StringCache.Delete(ctx, updateKey); err != nil {
			log.Errorf("Failed to clear update target: %v", err)
		}
		if err := self.srv.UpdateManager.ClearUpdatesCache(ctx); err != nil {
			log.Errorf("Failed to clear updates cache: %v", err)
		}
	}

	resp.Body.Ready = ready
	resp.Body.InProgress = updateInProgress && !ready
	if updateInProgress {
		resp.Body.TargetVersion = targetVersion
	}

	return resp, nil
}
