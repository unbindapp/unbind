package deployments_service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
	unbindv1 "github.com/unbindapp/unbind-operator/api/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	apimeta "k8s.io/apimachinery/pkg/api/meta"
)

const deploymentRolloutGracePeriod = 5 * time.Minute

// ServiceReplicaData holds replica data for a service
type ServiceReplicaData struct {
	ServiceID       uuid.UUID
	Status          schema.DeploymentStatus
	StatusMessage   string
	ReplicaEvents   []models.EventRecord
	Restarts        int32
	CrashingReasons []string
}

// AttachReplicaDataToServices efficiently attaches replica data to multiple services in an environment
// This makes a single Kubernetes call per environment instead of per service
// Always includes inferred events from container state (lightweight and reliable)
func (self *DeploymentService) AttachReplicaDataToServices(ctx context.Context, services []*ent.Service, namespace string) (map[uuid.UUID]*ServiceReplicaData, error) {
	if len(services) == 0 {
		return make(map[uuid.UUID]*ServiceReplicaData), nil
	}

	// Get all pod statuses for the environment in a single call
	// Inferred events from container state are always included (lightweight)
	statuses, err := self.k8s.GetPodContainerStatusByLabelsWithOptions(
		ctx,
		namespace,
		map[string]string{
			"unbind-environment": services[0].EnvironmentID.String(),
		},
		self.k8s.GetInternalClient(),
		k8s.PodStatusOptions{
			IncludeKubernetesEvents: false, // Skip expensive Kubernetes Events API for list views
		},
	)
	if err != nil {
		log.Error("Error getting pod container status for environment", "err", err, "environment_id", services[0].EnvironmentID)
		return nil, err
	}

	// Group statuses by service ID
	serviceStatuses := make(map[uuid.UUID][]k8s.PodContainerStatus)
	for _, status := range statuses {
		// The ServiceID is already parsed and stored in the PodContainerStatus struct
		if status.ServiceID != uuid.Nil {
			serviceStatuses[status.ServiceID] = append(serviceStatuses[status.ServiceID], status)
		}
	}

	// Calculate replica data for each service
	result := make(map[uuid.UUID]*ServiceReplicaData)
	for _, service := range services {
		if service.Edges.CurrentDeployment == nil || service.Edges.ServiceConfig == nil {
			continue
		}

		statuses := serviceStatuses[service.ID]
		isDatabase := service.Type == schema.ServiceTypeDatabase
		replicaData := self.calculateReplicaData(statuses, service.Edges.ServiceConfig.Replicas, service.Edges.CurrentDeployment, isDatabase)
		self.applyDatabaseCRStatus(ctx, service, namespace, replicaData)
		result[service.ID] = replicaData
	}

	return result, nil
}

// calculateReplicaData processes pod statuses to determine deployment status and events
func (self *DeploymentService) calculateReplicaData(statuses []k8s.PodContainerStatus, expectedReplicas int32, currentDeployment *ent.Deployment, isDatabase bool) *ServiceReplicaData {
	if currentDeployment != nil && currentDeployment.Status == schema.DeploymentStatusRemoved {
		return &ServiceReplicaData{
			Status:          schema.DeploymentStatusRemoved,
			ReplicaEvents:   []models.EventRecord{},
			CrashingReasons: []string{},
		}
	}

	events := []models.EventRecord{}
	crashingReasons := []string{}
	restartCount := int32(0)

	// gated on the label existing: some database operators don't propagate it to pods,
	// and those that do never refresh it, so the deployment id goes stale. Database
	// rollout progress comes from the CR condition in applyDatabaseCRStatus instead.
	countedStatuses := statuses
	staleEvents := []models.EventRecord{}
	noCurrentPods := false
	if currentDeployment != nil && !isDatabase && anyPodHasDeploymentLabel(statuses) {
		countedStatuses = make([]k8s.PodContainerStatus, 0, len(statuses))
		for _, status := range statuses {
			if status.DeploymentID == currentDeployment.ID {
				countedStatuses = append(countedStatuses, status)
				continue
			}
			for _, container := range status.Containers {
				staleEvents = append(staleEvents, container.Events...)
			}
			for _, container := range status.InitContainers {
				staleEvents = append(staleEvents, container.Events...)
			}
		}
		noCurrentPods = len(countedStatuses) == 0
	}

	hasCrashing := false
	hasPending := false
	readyCount := int32(0)

	for _, status := range countedStatuses {
		// Check if any containers are crashing at pod level
		if status.HasCrashingContainers {
			hasCrashing = true
		}

		for _, container := range status.Containers {
			restartCount += container.RestartCount
			// Always collect events from all containers
			events = append(events, container.Events...)

			// Handle different container states more precisely
			switch container.State {
			case k8s.ContainerStateCrashing:
				hasCrashing = true
				crashingReasons = append(crashingReasons, container.CrashLoopReason)
			case k8s.ContainerStateRunning:
				if container.Ready {
					readyCount++
				} else {
					// Running but not ready
					hasPending = true
				}
			case k8s.ContainerStateNotReady, k8s.ContainerStateWaiting, k8s.ContainerStateStarting, k8s.ContainerStateImagePullError:
				hasPending = true
			case k8s.ContainerStateTerminated:
				// Terminated containers might be crashing if they have restart counts or failed
				if container.IsCrashing {
					hasCrashing = true
					crashingReasons = append(crashingReasons, container.CrashLoopReason)
				}
			}
		}

		// Also process container dependencies (init containers)
		for _, container := range status.InitContainers {
			events = append(events, container.Events...)

			// Handle different init container states
			switch container.State {
			case k8s.ContainerStateCrashing:
				hasCrashing = true
				crashingReasons = append(crashingReasons, container.CrashLoopReason)
			case k8s.ContainerStateWaiting, k8s.ContainerStateStarting, k8s.ContainerStateImagePullError:
				hasPending = true
			case k8s.ContainerStateTerminated:
				if container.IsCrashing {
					hasCrashing = true
					crashingReasons = append(crashingReasons, container.CrashLoopReason)
				}
			}
		}
	}

	// Determine target status with improved logic:
	// 1. Crashing takes precedence over everything
	// 2. Pending if any containers are actively starting/waiting or we don't have enough ready replicas
	//    (but exclude terminating containers from this check)
	// 3. Active if we have enough ready replicas and no pending containers
	var targetStatus schema.DeploymentStatus
	if hasCrashing {
		targetStatus = schema.DeploymentStatusCrashing
	} else if hasPending || readyCount < expectedReplicas {
		targetStatus = schema.DeploymentStatusLaunching

		// Detect launch error
		for _, event := range events {
			if event.Type == models.EventTypeNodeNotReady ||
				event.Type == models.EventTypeSchedulingFailed ||
				event.Type == models.EventTypeImagePullBackOff {
				targetStatus = schema.DeploymentStatusLaunchError
				break
			}
		}
	} else {
		targetStatus = schema.DeploymentStatusActive
	}

	if noCurrentPods && expectedReplicas > 0 {
		targetStatus = schema.DeploymentStatusLaunching
		if time.Since(deploymentGraceAnchor(currentDeployment)) > deploymentRolloutGracePeriod {
			targetStatus = schema.DeploymentStatusLaunchError
			crashingReasons = append(crashingReasons, fmt.Sprintf("No pods from the current deployment after %s; rollout may be stuck", deploymentRolloutGracePeriod))
		}
	}

	return &ServiceReplicaData{
		Status:          targetStatus,
		ReplicaEvents:   append(events, staleEvents...),
		CrashingReasons: crashingReasons,
		Restarts:        restartCount,
	}
}

// pod-derived crashing keeps precedence over the CR condition
func (self *DeploymentService) applyDatabaseCRStatus(ctx context.Context, service *ent.Service, namespace string, data *ServiceReplicaData) {
	if service.Type != schema.ServiceTypeDatabase {
		return
	}

	status, err := self.k8s.GetUnbindServiceStatus(ctx, namespace, service.KubernetesName)
	if err != nil {
		if !kerrors.IsNotFound(err) {
			log.Warn("Failed to read service CR status", "err", err, "service_id", service.ID)
		}
		return
	}
	if status == nil {
		return
	}

	condition := apimeta.FindStatusCondition(status.Conditions, unbindv1.ConditionTypeDatabaseReady)
	if condition == nil {
		return
	}

	switch condition.Reason {
	case unbindv1.DatabaseReasonFailed:
		// A running cluster keeps serving through non-fatal sync hiccups (Zalando reports
		// SyncFailed/UpdateFailed for these), so surface the message but don't fail Active.
		data.StatusMessage = condition.Message
		if data.Status == schema.DeploymentStatusLaunching {
			data.Status = schema.DeploymentStatusLaunchError
		}
	case unbindv1.DatabaseReasonProgressing:
		if data.Status == schema.DeploymentStatusActive {
			data.Status = schema.DeploymentStatusLaunching
			data.StatusMessage = condition.Message
		}
	}
}

func anyPodHasDeploymentLabel(statuses []k8s.PodContainerStatus) bool {
	for _, status := range statuses {
		if status.DeploymentID != uuid.Nil {
			return true
		}
	}
	return false
}

func deploymentGraceAnchor(d *ent.Deployment) time.Time {
	switch {
	case d.CompletedAt != nil:
		return *d.CompletedAt
	case d.StartedAt != nil:
		return *d.StartedAt
	case d.QueuedAt != nil:
		return *d.QueuedAt
	default:
		return d.CreatedAt
	}
}

// AttachReplicaDataToDeploymentResponses attaches replica data to deployment responses
func (self *DeploymentService) AttachReplicaDataToDeploymentResponses(deployments []*models.DeploymentResponse, replicaData *ServiceReplicaData, currentDeploymentID uuid.UUID) {
	if replicaData == nil {
		return
	}

	for i := range deployments {
		if deployments[i].ID == currentDeploymentID {
			deployments[i].Status = replicaData.Status
			deployments[i].StatusMessage = replicaData.StatusMessage
			deployments[i].ReplicaEvents = replicaData.ReplicaEvents
			deployments[i].CrashingReasons = replicaData.CrashingReasons
			deployments[i].ReplicaRestarts = replicaData.Restarts
		} else {
			if deployments[i].Status == schema.DeploymentStatusBuildSucceeded {
				deployments[i].Status = schema.DeploymentStatusRemoved
			}
		}
	}
}

// AttachReplicaDataToServiceResponse attaches replica data to a single service response
// Returns the replica data that was attached, or nil if no data was available
func (self *DeploymentService) AttachReplicaDataToServiceResponse(service *models.ServiceResponse, replicaDataMap map[uuid.UUID]*ServiceReplicaData) *ServiceReplicaData {
	replicaData := replicaDataMap[service.ID]
	if replicaData == nil {
		return nil
	}

	// Attach to current deployment
	if service.CurrentDeployment != nil {
		service.CurrentDeployment.Status = replicaData.Status
		service.CurrentDeployment.StatusMessage = replicaData.StatusMessage
		service.CurrentDeployment.ReplicaEvents = replicaData.ReplicaEvents
		service.CurrentDeployment.CrashingReasons = replicaData.CrashingReasons
		service.CurrentDeployment.ReplicaRestarts = replicaData.Restarts
	}

	// Attach to last deployment if it's the current one
	if service.LastDeployment != nil && service.CurrentDeployment != nil &&
		service.LastDeployment.ID == service.CurrentDeployment.ID {
		service.LastDeployment.Status = replicaData.Status
		service.LastDeployment.StatusMessage = replicaData.StatusMessage
		service.LastDeployment.ReplicaEvents = replicaData.ReplicaEvents
		service.LastDeployment.CrashingReasons = replicaData.CrashingReasons
		service.LastDeployment.ReplicaRestarts = replicaData.Restarts
	}

	return replicaData
}

// AttachReplicaDataToServiceResponses attaches replica data to multiple service responses
// This is a convenience function that calls AttachReplicaDataToServiceResponse for each service
func (self *DeploymentService) AttachReplicaDataToServiceResponses(services []*models.ServiceResponse, replicaDataMap map[uuid.UUID]*ServiceReplicaData) {
	for _, service := range services {
		self.AttachReplicaDataToServiceResponse(service, replicaDataMap)
	}
}
