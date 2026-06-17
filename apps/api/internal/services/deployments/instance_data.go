package deployments_service

import (
	"context"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
)

// ServiceInstanceData holds instance data for a service
type ServiceInstanceData struct {
	ServiceID       uuid.UUID
	Status          schema.DeploymentStatus
	InstanceEvents  []models.EventRecord
	Restarts        int32
	CrashingReasons []string
}

// AttachInstanceDataToServices efficiently attaches instance data to multiple services in an environment
// This makes a single Kubernetes call per environment instead of per service
// Always includes inferred events from container state (lightweight and reliable)
func (self *DeploymentService) AttachInstanceDataToServices(ctx context.Context, services []*ent.Service, namespace string) (map[uuid.UUID]*ServiceInstanceData, error) {
	if len(services) == 0 {
		return make(map[uuid.UUID]*ServiceInstanceData), nil
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

	// Calculate instance data for each service
	result := make(map[uuid.UUID]*ServiceInstanceData)
	for _, service := range services {
		if service.Edges.CurrentDeployment == nil || service.Edges.ServiceConfig == nil {
			continue
		}

		statuses := serviceStatuses[service.ID]
		instanceData := self.calculateInstanceData(statuses, service.Edges.ServiceConfig.Replicas)
		result[service.ID] = instanceData
	}

	return result, nil
}

// AttachInstanceDataToServicesWithKubernetesEvents efficiently attaches instance data with full Kubernetes Events API
// This version includes both inferred events and Kubernetes Events API data for detailed views
func (self *DeploymentService) AttachInstanceDataToServicesWithKubernetesEvents(ctx context.Context, services []*ent.Service, namespace string) (map[uuid.UUID]*ServiceInstanceData, error) {
	if len(services) == 0 {
		return make(map[uuid.UUID]*ServiceInstanceData), nil
	}

	// Get all pod statuses for the environment in a single call with full Kubernetes Events API
	statuses, err := self.k8s.GetPodContainerStatusByLabelsWithOptions(
		ctx,
		namespace,
		map[string]string{
			"unbind-environment": services[0].EnvironmentID.String(),
		},
		self.k8s.GetInternalClient(),
		k8s.PodStatusOptions{
			IncludeKubernetesEvents: true, // Include full Kubernetes Events API for detailed views
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

	// Calculate instance data for each service
	result := make(map[uuid.UUID]*ServiceInstanceData)
	for _, service := range services {
		if service.Edges.CurrentDeployment == nil || service.Edges.ServiceConfig == nil {
			continue
		}

		statuses := serviceStatuses[service.ID]
		instanceData := self.calculateInstanceData(statuses, service.Edges.ServiceConfig.Replicas)
		result[service.ID] = instanceData
	}

	return result, nil
}

// calculateInstanceData processes pod statuses to determine deployment status and events
func (self *DeploymentService) calculateInstanceData(statuses []k8s.PodContainerStatus, expectedReplicas int32) *ServiceInstanceData {
	events := []models.EventRecord{}
	crashingReasons := []string{}
	restartCount := int32(0)

	hasCrashing := false
	hasPending := false
	readyCount := int32(0)

	// Process each pod status
	for _, status := range statuses {
		// Check if any containers are crashing at pod level
		if status.HasCrashingInstances {
			hasCrashing = true
		}

		// Process container instances
		for _, instance := range status.Instances {
			restartCount += instance.RestartCount
			// Always collect events from all containers
			events = append(events, instance.Events...)

			// Handle different container states more precisely
			switch instance.State {
			case k8s.ContainerStateCrashing:
				hasCrashing = true
				crashingReasons = append(crashingReasons, instance.CrashLoopReason)
			case k8s.ContainerStateRunning:
				if instance.Ready {
					readyCount++
				} else {
					// Running but not ready
					hasPending = true
				}
			case k8s.ContainerStateNotReady, k8s.ContainerStateWaiting, k8s.ContainerStateStarting, k8s.ContainerStateImagePullError:
				hasPending = true
			case k8s.ContainerStateTerminated:
				// Terminated containers might be crashing if they have restart counts or failed
				if instance.IsCrashing {
					hasCrashing = true
					crashingReasons = append(crashingReasons, instance.CrashLoopReason)
				}
			}
		}

		// Also process instance dependencies (init containers)
		for _, instance := range status.InstanceDependencies {
			events = append(events, instance.Events...)

			// Handle different init container states
			switch instance.State {
			case k8s.ContainerStateCrashing:
				hasCrashing = true
				crashingReasons = append(crashingReasons, instance.CrashLoopReason)
			case k8s.ContainerStateWaiting, k8s.ContainerStateStarting, k8s.ContainerStateImagePullError:
				hasPending = true
			case k8s.ContainerStateTerminated:
				if instance.IsCrashing {
					hasCrashing = true
					crashingReasons = append(crashingReasons, instance.CrashLoopReason)
				}
			}
		}
	}

	// Determine target status with improved logic:
	// 1. Crashing takes precedence over everything
	// 2. Pending if any containers are actively starting/waiting or we don't have enough ready instances
	//    (but exclude terminating containers from this check)
	// 3. Active if we have enough ready instances and no pending containers
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

	return &ServiceInstanceData{
		Status:          targetStatus,
		InstanceEvents:  events,
		CrashingReasons: crashingReasons,
		Restarts:        restartCount,
	}
}

// AttachInstanceDataToDeploymentResponses attaches instance data to deployment responses
func (self *DeploymentService) AttachInstanceDataToDeploymentResponses(deployments []*models.DeploymentResponse, instanceData *ServiceInstanceData, currentDeploymentID uuid.UUID) {
	if instanceData == nil {
		return
	}

	for i := range deployments {
		if deployments[i].ID == currentDeploymentID {
			deployments[i].Status = instanceData.Status
			deployments[i].InstanceEvents = instanceData.InstanceEvents
			deployments[i].CrashingReasons = instanceData.CrashingReasons
			deployments[i].InstanceRestarts = instanceData.Restarts
		} else {
			if deployments[i].Status == schema.DeploymentStatusBuildSucceeded {
				deployments[i].Status = schema.DeploymentStatusRemoved
			}
		}
	}
}

// AttachInstanceDataToServiceResponse attaches instance data to a single service response
// Returns the instance data that was attached, or nil if no data was available
func (self *DeploymentService) AttachInstanceDataToServiceResponse(service *models.ServiceResponse, instanceDataMap map[uuid.UUID]*ServiceInstanceData) *ServiceInstanceData {
	instanceData := instanceDataMap[service.ID]
	if instanceData == nil {
		return nil
	}

	// Attach to current deployment
	if service.CurrentDeployment != nil {
		service.CurrentDeployment.Status = instanceData.Status
		service.CurrentDeployment.InstanceEvents = instanceData.InstanceEvents
		service.CurrentDeployment.CrashingReasons = instanceData.CrashingReasons
		service.CurrentDeployment.InstanceRestarts = instanceData.Restarts
	}

	// Attach to last deployment if it's the current one
	if service.LastDeployment != nil && service.CurrentDeployment != nil &&
		service.LastDeployment.ID == service.CurrentDeployment.ID {
		service.LastDeployment.Status = instanceData.Status
		service.LastDeployment.InstanceEvents = instanceData.InstanceEvents
		service.LastDeployment.CrashingReasons = instanceData.CrashingReasons
		service.LastDeployment.InstanceRestarts = instanceData.Restarts
	}

	return instanceData
}

// AttachInstanceDataToServiceResponses attaches instance data to multiple service responses
// This is a convenience function that calls AttachInstanceDataToServiceResponse for each service
func (self *DeploymentService) AttachInstanceDataToServiceResponses(services []*models.ServiceResponse, instanceDataMap map[uuid.UUID]*ServiceInstanceData) {
	for _, service := range services {
		self.AttachInstanceDataToServiceResponse(service, instanceDataMap)
	}
}
