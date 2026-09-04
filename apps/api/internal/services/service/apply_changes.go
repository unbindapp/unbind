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

// ApplyChanges validates every staged change up front, persists them, and rolls out
// each affected service exactly once. With DryRun it stops after reporting the plan.
func (self *ServiceService) ApplyChanges(ctx context.Context, requesterUserID uuid.UUID, input *models.ApplyChangesInput) (*models.ApplyChangesResponse, error) {
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
		if err := self.applyServiceUpdate(ctx, update); err != nil {
			log.Errorf("failed to apply changes to service %s: %v", update.service.ID, err)
			failures = append(failures, models.ChangeFailure{ServiceID: &update.service.ID, Message: failureMessage(err)})
			continue
		}
		touched.get(update.service.ID).config = true
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

	return &models.ApplyChangesResponse{Affected: affected, Failures: failures}, nil
}

// planChanges reports what applying the prepared changes would do
func (self *ServiceService) planChanges(ctx context.Context, updates []*serviceUpdate, writes []*variables_service.VariableWrite) (*models.ApplyChangesResponse, error) {
	touched := touchedServices{}
	estimates := make(map[uuid.UUID]service_repo.NeedsDeploymentResponse, len(updates))
	for _, update := range updates {
		touch := touched.get(update.service.ID)
		touch.config = true
		touch.service = update.service
		estimates[update.service.ID] = estimateConfigChange(update.service.Edges.ServiceConfig, update.input)
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

	return &models.ApplyChangesResponse{DryRun: true, Affected: affected, Failures: []models.ChangeFailure{}}, nil
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
