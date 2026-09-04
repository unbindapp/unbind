package service_service

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/models"
	service_repo "github.com/unbindapp/unbind-api/internal/repositories/service"
	variables_service "github.com/unbindapp/unbind-api/internal/services/variables"
)

// serviceTouch records why a service is affected by a set of changes
type serviceTouch struct {
	config    bool
	variables bool
	// rendered is true when a variable rendered into the deployment changed
	rendered bool
	// references are changed keys on other scopes that this service references
	references []string
	service    *ent.Service
}

func (self *serviceTouch) reasons() []models.ChangeReason {
	reasons := []models.ChangeReason{}
	if self.config {
		reasons = append(reasons, models.ChangeReasonConfig)
	}
	if self.variables {
		reasons = append(reasons, models.ChangeReasonVariables)
	}
	if len(self.references) > 0 {
		reasons = append(reasons, models.ChangeReasonReference)
	}
	return reasons
}

type touchedServices map[uuid.UUID]*serviceTouch

func (self touchedServices) get(id uuid.UUID) *serviceTouch {
	touch, ok := self[id]
	if ok {
		return touch
	}
	touch = &serviceTouch{}
	self[id] = touch
	return touch
}

func (self touchedServices) sortedIDs() []uuid.UUID {
	ids := make([]uuid.UUID, 0, len(self))
	for id := range self {
		ids = append(ids, id)
	}
	slices.SortFunc(ids, func(a, b uuid.UUID) int { return strings.Compare(a.String(), b.String()) })
	return ids
}

// touchVariableWrite records the service that owns the write and every deployed
// service referencing a changed key
func (self *ServiceService) touchVariableWrite(ctx context.Context, touched touchedServices, write *variables_service.VariableWrite) {
	if !write.HasChanges() {
		return
	}
	if write.IsService() {
		touch := touched.get(write.ServiceID())
		touch.variables = true
		touch.rendered = touch.rendered || write.NeedsRedeploy
	}

	referencing, err := self.variableService.FindReferencingServices(ctx, write.Input.Type, write.SourceID(), write.ChangedKeys)
	if err != nil {
		log.Errorf("failed to find services referencing %s: %v", write.SourceID(), err)
		return
	}
	for _, service := range referencing {
		touch := touched.get(service.ID)
		touch.references = append(touch.references, write.ChangedKeys...)
		if touch.service == nil {
			touch.service = service
		}
	}
}

// resolveChangeAction picks the single rollout a touched service needs
func resolveChangeAction(active bool, needs service_repo.NeedsDeploymentResponse, touch *serviceTouch) models.ChangeAction {
	if !active {
		return models.ChangeActionNone
	}
	switch needs {
	case service_repo.NeedsBuildAndDeployment:
		return models.ChangeActionBuild
	case service_repo.NeedsDeployment:
		return models.ChangeActionRedeploy
	}
	if touch.rendered || len(touch.references) > 0 {
		return models.ChangeActionRedeploy
	}
	if touch.variables {
		return models.ChangeActionRestart
	}
	return models.ChangeActionNone
}

// estimateConfigChange guesses what an update would need without applying it
func estimateConfigChange(config *ent.ServiceConfig, input *models.UpdateServiceInput) service_repo.NeedsDeploymentResponse {
	if input.Builder != nil && *input.Builder != config.Builder ||
		stringChanged(input.GitBranch, config.GitBranch) ||
		stringChanged(input.RailpackBuilderInstallCommand, config.RailpackBuilderInstallCommand) ||
		stringChanged(input.RailpackBuilderBuildCommand, config.RailpackBuilderBuildCommand) ||
		stringChanged(input.DockerBuilderDockerfilePath, config.DockerBuilderDockerfilePath) ||
		stringChanged(input.DockerBuilderBuildContext, config.DockerBuilderBuildContext) {
		return service_repo.NeedsBuildAndDeployment
	}

	if input.Replicas != nil && *input.Replicas != config.Replicas ||
		input.IsPublic != nil && *input.IsPublic != config.IsPublic ||
		input.Image != nil && *input.Image != config.Image ||
		stringChanged(input.RunCommand, config.RunCommand) ||
		len(input.OverwriteHosts)+len(input.UpsertHosts)+len(input.RemoveHosts) > 0 ||
		len(input.OverwritePorts)+len(input.AddPorts)+len(input.RemovePorts) > 0 ||
		len(input.OverwriteVolumes)+len(input.AddVolumes)+len(input.RemoveVolumes) > 0 ||
		len(input.OverwriteVariableMounts)+len(input.AddVariableMounts)+len(input.RemoveVariableMounts) > 0 ||
		input.HealthCheck != nil ||
		input.Resources != nil ||
		input.S3BackupBucketID != nil ||
		input.BackupSchedule != nil ||
		input.BackupRetentionCount != nil {
		return service_repo.NeedsDeployment
	}

	return service_repo.NoDeploymentNeeded
}

func stringChanged(input, current *string) bool {
	if input == nil {
		return false
	}
	if current == nil {
		return *input != ""
	}
	return *input != *current
}

type rolloutResult struct {
	service    *ent.Service
	action     models.ChangeAction
	deployment *ent.Deployment
	err        error
}

func (self *rolloutResult) affected(touch *serviceTouch) models.AffectedService {
	affected := models.AffectedService{
		ServiceID: self.service.ID,
		Name:      self.service.Name,
		Action:    self.action,
		Reasons:   touch.reasons(),
	}
	if self.deployment != nil {
		affected.DeploymentID = &self.deployment.ID
	}
	return affected
}

// rollout re-reads every touched service and performs the one action it needs
func (self *ServiceService) rollout(ctx context.Context, touched touchedServices) (map[uuid.UUID]*rolloutResult, error) {
	results := make(map[uuid.UUID]*rolloutResult, len(touched))
	var errs []error

	for _, id := range touched.sortedIDs() {
		service, err := self.repo.Service().GetByID(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("failed to re-fetch service %s: %w", id, err)
		}

		active := service_repo.HasActiveDeployment(service)
		needs := service_repo.NoDeploymentNeeded
		if active {
			needs, err = self.repo.Service().NeedsDeployment(ctx, service)
			if err != nil {
				return nil, fmt.Errorf("failed to check deployment needs for service %s: %w", id, err)
			}
		}

		result := &rolloutResult{service: service, action: resolveChangeAction(active, needs, touched[id])}
		results[id] = result

		switch result.action {
		case models.ChangeActionBuild:
			result.err = self.EnqueueFullBuildDeployments(ctx, []*ent.Service{service})
		case models.ChangeActionRedeploy:
			result.deployment, result.err = self.deployAdhocService(ctx, service)
		case models.ChangeActionRestart:
			namespace := service.Edges.Environment.Edges.Project.Edges.Team.Namespace
			label := schema.VariableReferenceSourceTypeService.KubernetesLabel()
			result.err = self.k8s.RollingRestartPodsByLabel(ctx, namespace, label, service.ID.String(), self.k8s.GetInternalClient())
		}
		if result.err != nil {
			log.Errorf("failed to roll out service %s: %v", id, result.err)
			errs = append(errs, fmt.Errorf("failed to roll out service %s: %w", service.Name, result.err))
		}
	}

	return results, errors.Join(errs...)
}
