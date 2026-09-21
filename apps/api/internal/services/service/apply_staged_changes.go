package service_service

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	service_repo "github.com/unbindapp/unbind-api/internal/repositories/service"
	variables_service "github.com/unbindapp/unbind-api/internal/services/variables"
)

// ApplyStagedChanges validates every staged change up front, persists them, and rolls out
// each affected service exactly once. With DryRun it stops after reporting the plan.
func (self *ServiceService) ApplyStagedChanges(ctx context.Context, requesterUserID uuid.UUID, input *models.ApplyStagedChangesInput) (*models.ApplyStagedChangesResponse, error) {
	if len(input.Services) == 0 && len(input.Variables) == 0 {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "No changes to apply")
	}

	seen := make(map[uuid.UUID]struct{}, len(input.Services))
	updates := make([]*serviceUpdate, 0, len(input.Services))
	for _, serviceInput := range input.Services {
		if _, ok := seen[serviceInput.ServiceID]; ok {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("Service %s appears more than once", serviceInput.ServiceID))
		}
		seen[serviceInput.ServiceID] = struct{}{}

		update, err := self.prepareServiceUpdate(ctx, requesterUserID, serviceInput)
		if err != nil {
			return nil, prefixError(fmt.Sprintf("Service %s", serviceInput.ServiceID), err)
		}
		updates = append(updates, update)
	}

	if err := self.checkHostClaims(ctx, updates); err != nil {
		return nil, err
	}
	if name, ok := nameClaimedTwice(updates); ok {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeConflict, fmt.Sprintf("More than one service is renamed to \"%s\"", name))
	}
	sortHostReleasesFirst(updates)

	writes := make([]*variables_service.VariableWrite, 0, len(input.Variables))
	for _, variableInput := range input.Variables {
		upserts := make(map[string][]byte, len(variableInput.Upserts))
		for _, variable := range variableInput.Upserts {
			upserts[variable.Name] = []byte(variable.Value)
		}
		write, err := self.variableService.PrepareVariableWrite(ctx, requesterUserID, variableInput.BaseVariablesJSONInput, models.VariableUpdateBehaviorUpsert, upserts, variableInput.Deletes)
		if err != nil {
			return nil, prefixError(fmt.Sprintf("%s variables", variableInput.Type), err)
		}
		writes = append(writes, write)
	}

	if input.DryRun {
		return self.planChanges(ctx, updates, writes)
	}

	touched := touchedServices{}
	failures := []models.ChangeFailure{}
	applied := make([]*serviceUpdate, 0, len(updates))
	for _, update := range updates {
		updated, err := self.applyServiceUpdate(ctx, update)
		if err != nil {
			log.Errorf("failed to apply changes to service %s: %v", update.service.ID, err)
			failures = append(failures, models.ChangeFailure{ServiceID: &update.service.ID, Message: failureMessage(err)})
			continue
		}
		self.touchServiceConfig(ctx, touched, updated, update.service.Edges.ServiceConfig, updated.Edges.ServiceConfig)
		applied = append(applied, update)
	}
	for _, write := range writes {
		if _, err := self.variableService.ApplyVariableWrite(ctx, write); err != nil {
			log.Errorf("failed to apply %s variable changes: %v", write.Input.Type, err)
			scope := write.Input
			failures = append(failures, models.ChangeFailure{Variables: &scope, Message: failureMessage(err)})
			continue
		}
		self.touchVariableWrite(ctx, touched, write)
	}

	results, err := self.rollout(ctx, touched)
	if err != nil {
		if results == nil {
			return nil, err
		}
		for _, result := range results {
			if result.err != nil {
				failures = append(failures, models.ChangeFailure{ServiceID: &result.service.ID, Message: failureMessage(result.err)})
			}
		}
	}

	for _, update := range applied {
		result := results[update.service.ID]
		go self.notifyServiceUpdated(requesterUserID, update.input, result.service, result.deployment)
	}

	affected := make([]models.AffectedService, 0, len(results))
	for id, result := range results {
		affected = append(affected, result.affected(touched[id]))
	}
	sortAffected(affected)

	return &models.ApplyStagedChangesResponse{Affected: affected, Failures: failures}, nil
}

// planChanges reports what applying the prepared changes would do
func (self *ServiceService) planChanges(ctx context.Context, updates []*serviceUpdate, writes []*variables_service.VariableWrite) (*models.ApplyStagedChangesResponse, error) {
	touched := touchedServices{}
	estimates := make(map[uuid.UUID]service_repo.NeedsDeploymentResponse, len(updates))
	for _, update := range updates {
		config := update.service.Edges.ServiceConfig
		self.touchServiceConfig(ctx, touched, update.service, config, projectConfig(config, update.input))
		estimates[update.service.ID] = estimateConfigChange(config, update.input)
	}
	for _, write := range writes {
		self.touchVariableWrite(ctx, touched, write)
	}

	affected := make([]models.AffectedService, 0, len(touched))
	for _, id := range touched.sortedIDs() {
		touch := touched[id]
		if touch.service == nil {
			service, err := self.repo.Service().GetByID(ctx, id)
			if err != nil {
				return nil, err
			}
			touch.service = service
		}
		needs, ok := estimates[id]
		if !ok {
			needs = service_repo.NoDeploymentNeeded
		}
		result := &rolloutResult{
			service: touch.service,
			action:  resolveChangeAction(service_repo.HasActiveDeployment(touch.service), needs, touch),
		}
		affected = append(affected, result.affected(touch))
	}
	sortAffected(affected)

	return &models.ApplyStagedChangesResponse{DryRun: true, Affected: affected, Failures: []models.ChangeFailure{}}, nil
}

// checkHostClaims reports a taken domain before anything is written. A domain another
// service gives up in the same batch is left to the check that runs while applying.
func (self *ServiceService) checkHostClaims(ctx context.Context, updates []*serviceUpdate) error {
	inputs := make([]*models.UpdateServiceInput, 0, len(updates))
	for _, update := range updates {
		inputs = append(inputs, update.input)
	}
	if host, ok := hostClaimedTwice(inputs); ok {
		return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("domain %s is added to more than one service", host))
	}

	for _, update := range updates {
		released := releasedHosts(inputs, update.input.ServiceID)
		for _, host := range claimedHosts(update.input) {
			if _, ok := released[host]; ok {
				continue
			}
			count, err := self.repo.Service().CountDomainCollisons(ctx, nil, host, &update.service.ID)
			if err != nil {
				return errdefs.NewInternalError(err, "Failed to check the domain for collisions")
			}
			if count > 0 {
				return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, fmt.Sprintf("domain %s already in use", host))
			}
		}
	}
	return nil
}

// each rename was only checked against the saved names, not against the other renames
func nameClaimedTwice(updates []*serviceUpdate) (string, bool) {
	claimed := map[string]struct{}{}
	for _, update := range updates {
		if update.input.Name == nil || *update.input.Name == update.service.Name {
			continue
		}
		key := update.service.EnvironmentID.String() + "/" + *update.input.Name
		if _, ok := claimed[key]; ok {
			return *update.input.Name, true
		}
		claimed[key] = struct{}{}
	}
	return "", false
}

func claimedHosts(input *models.UpdateServiceInput) []string {
	hosts := make([]string, 0, len(input.OverwriteHosts)+len(input.UpsertHosts))
	for _, host := range slices.Concat(input.OverwriteHosts, input.UpsertHosts) {
		hosts = append(hosts, strings.ToLower(host.Host))
	}
	return hosts
}

func hostClaimedTwice(inputs []*models.UpdateServiceInput) (string, bool) {
	claimedBy := map[string]uuid.UUID{}
	for _, input := range inputs {
		for _, host := range claimedHosts(input) {
			if owner, ok := claimedBy[host]; ok && owner != input.ServiceID {
				return host, true
			}
			claimedBy[host] = input.ServiceID
		}
	}
	return "", false
}

// releasedHosts lists the domains the other services in the batch remove or rename away from
func releasedHosts(inputs []*models.UpdateServiceInput, exceptServiceID uuid.UUID) map[string]struct{} {
	released := map[string]struct{}{}
	for _, input := range inputs {
		if input.ServiceID == exceptServiceID {
			continue
		}
		for _, host := range input.RemoveHosts {
			released[strings.ToLower(host.Host)] = struct{}{}
		}
		for _, host := range input.UpsertHosts {
			if host.PrevHost != nil && !strings.EqualFold(*host.PrevHost, host.Host) {
				released[strings.ToLower(*host.PrevHost)] = struct{}{}
			}
		}
	}
	return released
}

// A domain moving between two services has to leave the first before the second takes it
func sortHostReleasesFirst(updates []*serviceUpdate) {
	releases := func(update *serviceUpdate) bool {
		return len(releasedHosts([]*models.UpdateServiceInput{update.input}, uuid.Nil)) > 0
	}
	slices.SortStableFunc(updates, func(a, b *serviceUpdate) int {
		if releases(a) == releases(b) {
			return 0
		}
		if releases(a) {
			return -1
		}
		return 1
	})
}

func sortAffected(affected []models.AffectedService) {
	slices.SortFunc(affected, func(a, b models.AffectedService) int {
		return strings.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name))
	})
}

// prefixError keeps the error type so the handler still maps it to the right status
func prefixError(prefix string, err error) error {
	var custom *errdefs.CustomError
	if errors.As(err, &custom) {
		return errdefs.NewCustomError(custom.Type, fmt.Sprintf("%s: %s", prefix, custom.Message))
	}
	return fmt.Errorf("%s: %w", prefix, err)
}

// failureMessage only exposes messages written for users, internal errors stay in the logs
func failureMessage(err error) string {
	var custom *errdefs.CustomError
	if errors.As(err, &custom) {
		return custom.Message
	}
	return "Internal error"
}
