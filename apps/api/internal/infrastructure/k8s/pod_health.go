package k8s

import (
	"context"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/models"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// GetPodContainerStatusByLabels efficiently fetches pod status with inferred events from container state
func (self *KubeClient) GetPodContainerStatusByLabels(ctx context.Context, namespace string, labels map[string]string, client kubernetes.Interface) ([]PodContainerStatus, error) {
	return self.GetPodContainerStatusByLabelsWithOptions(ctx, namespace, labels, client, PodStatusOptions{
		IncludeKubernetesEvents: false, // Only inferred events by default
	})
}

// PodStatusOptions controls what data to fetch for pod status
type PodStatusOptions struct {
	IncludeKubernetesEvents bool // Whether to fetch additional events from Kubernetes Events API (more expensive)
}

// GetPodContainerStatusByLabelsWithOptions efficiently fetches pod status with configurable options
// Container state events are always inferred (lightweight and reliable)
func (self *KubeClient) GetPodContainerStatusByLabelsWithOptions(ctx context.Context, namespace string, labels map[string]string, client kubernetes.Interface, options PodStatusOptions) ([]PodContainerStatus, error) {
	pods, err := self.GetPodsByLabels(ctx, namespace, labels, client)
	if err != nil {
		return nil, fmt.Errorf("failed to get pods: %w", err)
	}

	result := make([]PodContainerStatus, 0, len(pods.Items))

	// Batch fetch Kubernetes Events API events for all pods if requested
	var allEvents []models.EventRecord
	if options.IncludeKubernetesEvents && len(pods.Items) > 0 {
		allEvents, err = self.getBatchPodEvents(ctx, namespace, pods.Items, client)
		if err != nil {
			// Log warning but continue without Kubernetes events
			fmt.Printf("Warning: failed to get Kubernetes events for pods: %v\n", err)
			allEvents = []models.EventRecord{}
		}
	}

	for _, pod := range pods.Items {
		serviceID, _ := uuid.Parse(pod.Labels["unbind-service"])
		environmentID, _ := uuid.Parse(pod.Labels["unbind-environment"])
		projectID, _ := uuid.Parse(pod.Labels["unbind-project"])
		teamID, _ := uuid.Parse(pod.Labels["unbind-team"])

		podStatus := PodContainerStatus{
			KubernetesName:       pod.Name,
			Namespace:            pod.Namespace,
			Phase:                mapKubernetesPodPhase(pod.Status.Phase),
			PodIP:                pod.Status.PodIP,
			Instances:            make([]InstanceStatus, 0, len(pod.Status.ContainerStatuses)),
			InstanceDependencies: make([]InstanceStatus, 0, len(pod.Status.InitContainerStatuses)),
			TeamID:               teamID,
			ProjectID:            projectID,
			EnvironmentID:        environmentID,
			ServiceID:            serviceID,
			IsTerminating:        isPodTerminating(pod), // Add terminating detection
		}

		if pod.Status.StartTime != nil {
			podStatus.StartTime = pod.Status.StartTime.Format(time.RFC3339)
		}

		// Set pod creation timestamp
		podStatus.CreatedAt = pod.CreationTimestamp.Time

		// Filter Kubernetes events for this specific pod if requested
		var podEvents []models.EventRecord
		if options.IncludeKubernetesEvents {
			podEvents = filterEventsByPod(allEvents, pod.Name)
		}

		hasCrashing := false
		for _, container := range pod.Status.ContainerStatuses {
			// Always extract inferred events from container state (lightweight and reliable)
			instanceStatus := extractContainerStatus(container, podStatus.IsTerminating, podStatus.CreatedAt)

			// Optionally append additional Kubernetes Events API events
			if options.IncludeKubernetesEvents {
				filteredEvents := filterEventsByContainer(podEvents, container.Name)
				instanceStatus.Events = append(instanceStatus.Events, filteredEvents...)
			}

			if instanceStatus.IsCrashing {
				hasCrashing = true
			}
			podStatus.Instances = append(podStatus.Instances, instanceStatus)
		}

		for _, container := range pod.Status.InitContainerStatuses {
			// Always extract inferred events from container state
			instanceStatus := extractContainerStatus(container, podStatus.IsTerminating, podStatus.CreatedAt)

			// Optionally append additional Kubernetes Events API events
			if options.IncludeKubernetesEvents {
				filteredEvents := filterEventsByContainer(podEvents, container.Name)
				instanceStatus.Events = append(instanceStatus.Events, filteredEvents...)
			}

			if instanceStatus.IsCrashing {
				hasCrashing = true
			}
			podStatus.InstanceDependencies = append(podStatus.InstanceDependencies, instanceStatus)
		}

		podStatus.HasCrashingInstances = hasCrashing

		result = append(result, podStatus)
	}

	// Sort by creation time descending (newest first)
	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})

	return result, nil
}

// isPodTerminating checks if a pod is in the process of being terminated
func isPodTerminating(pod corev1.Pod) bool {
	// Pod has a deletion timestamp - it's being terminated
	if pod.DeletionTimestamp != nil {
		return true
	}

	// Pod phase is failed and it's being cleaned up
	if pod.Status.Phase == corev1.PodFailed {
		return false // Failed pods are not terminating, they're already failed
	}

	// Check if pod has terminating conditions
	for _, condition := range pod.Status.Conditions {
		if condition.Type == corev1.PodReady &&
			condition.Status == corev1.ConditionFalse &&
			strings.Contains(strings.ToLower(condition.Reason), "terminat") {
			return true
		}
	}

	return false
}

// getBatchPodEvents efficiently fetches events for multiple pods in a single API call
func (self *KubeClient) getBatchPodEvents(ctx context.Context, namespace string, pods []corev1.Pod, client kubernetes.Interface) ([]models.EventRecord, error) {
	result := make([]models.EventRecord, 0)

	// Single API call to get all events in the namespace
	eventsV1, err := client.EventsV1().Events(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list events: %w", err)
	}

	// Create a map of pod names for efficient lookup
	podNames := make(map[string]bool, len(pods))
	for _, pod := range pods {
		podNames[pod.Name] = true
	}

	// Filter events to only include those related to our pods
	for _, event := range eventsV1.Items {
		isRelevant := false

		// Check if event is directly related to one of our pods
		if strings.EqualFold(event.Regarding.Kind, "Pod") && podNames[event.Regarding.Name] {
			isRelevant = true
		} else {
			// Check if event mentions any of our pod names
			for podName := range podNames {
				if strings.Contains(event.Note, podName) {
					isRelevant = true
					break
				}
				if strings.EqualFold(event.Regarding.Kind, "Container") && strings.HasPrefix(event.Regarding.Name, podName) {
					isRelevant = true
					break
				}
			}
		}

		if isRelevant {
			eventType := mapEventType(event.Reason, event.Note)

			record := models.EventRecord{
				Type:      eventType,
				Timestamp: event.EventTime.Format(time.RFC3339),
				Message:   event.Note,
				Count:     1,
				Reason:    event.Reason,
			}
			if event.Series != nil {
				record.Count = event.Series.Count
			}

			if !event.EventTime.IsZero() {
				record.FirstSeen = event.EventTime.Format(time.RFC3339)
				record.LastSeen = event.EventTime.Format(time.RFC3339)
			}

			result = append(result, record)
		}
	}

	return result, nil
}

// filterEventsByPod filters events to only include those related to a specific pod
func filterEventsByPod(events []models.EventRecord, podName string) []models.EventRecord {
	result := make([]models.EventRecord, 0)

	for _, event := range events {
		if strings.Contains(event.Message, podName) || strings.Contains(event.Reason, podName) {
			result = append(result, event)
		}
	}

	return result
}

func mapEventType(reason, message string) models.EventType {
	reasonLower := strings.ToLower(reason)
	messageLower := strings.ToLower(message)

	switch {
	case strings.Contains(reasonLower, "oom") || strings.Contains(messageLower, "out of memory"):
		return models.EventTypeOOMKilled
	case strings.Contains(reasonLower, "imagepullbackoff"):
		return models.EventTypeImagePullBackOff
	case strings.Contains(reasonLower, "backoff") || strings.Contains(reasonLower, "crashloop"):
		return models.EventTypeCrashLoopBackOff
	case strings.Contains(reasonLower, "created") || reasonLower == "created":
		return models.EventTypeContainerCreated
	case strings.Contains(reasonLower, "started") || reasonLower == "started":
		return models.EventTypeContainerStarted
	case strings.Contains(reasonLower, "pulled") || strings.Contains(messageLower, "successfully pulled image"):
		return models.EventTypeContainerCreated
	case strings.Contains(reasonLower, "killing") || strings.Contains(reasonLower, "killed") || strings.Contains(reasonLower, "stopped"):
		return models.EventTypeContainerStopped
	case strings.Contains(reasonLower, "nodenotready"):
		return models.EventTypeNodeNotReady
	case strings.Contains(reasonLower, "failedscheduling"):
		return models.EventTypeSchedulingFailed
	case strings.Contains(reasonLower, "failed") || strings.Contains(messageLower, "failed"):
		return models.EventTypeUnknown
	default:
		return models.EventTypeUnknown
	}
}

func filterEventsByContainer(events []models.EventRecord, containerName string) []models.EventRecord {
	result := make([]models.EventRecord, 0)

	for _, event := range events {
		if strings.Contains(event.Message, containerName) {
			result = append(result, event)
			continue
		}

		reasonLower := strings.ToLower(event.Reason)
		messageLower := strings.ToLower(event.Message)

		if strings.Contains(reasonLower, "created") ||
			strings.Contains(reasonLower, "started") ||
			strings.Contains(reasonLower, "pulled") ||
			strings.Contains(reasonLower, "killing") ||
			strings.Contains(reasonLower, "preempting") ||
			strings.Contains(messageLower, "container") ||
			strings.Contains(messageLower, "image") {
			result = append(result, event)
			continue
		}

		if event.Type == models.EventTypeOOMKilled ||
			event.Type == models.EventTypeCrashLoopBackOff ||
			event.Type == models.EventTypeContainerStopped ||
			strings.Contains(messageLower, "failed") ||
			strings.Contains(messageLower, "error") ||
			strings.Contains(messageLower, "warning") {
			result = append(result, event)
		}
	}

	return result
}

// extractContainerStatus infers some events from the container status, since Events API may not always have old events
func extractContainerStatus(container corev1.ContainerStatus, isPodTerminating bool, podCreatedAt time.Time) InstanceStatus {
	status := InstanceStatus{
		KubernetesName: container.Name,
		Ready:          container.Ready,
		RestartCount:   container.RestartCount,
		IsCrashing:     false,
		PodCreatedAt:   podCreatedAt,
		Events:         []models.EventRecord{},
	}

	switch {
	case container.State.Running != nil:
		// If pod is terminating, container should be marked as terminating even if running
		if isPodTerminating {
			status.State = ContainerStateTerminating
			status.StateReason = "Terminating"
			status.StateMessage = "Container is being terminated"

			status.Events = append(status.Events, models.EventRecord{
				Type:      models.EventTypeContainerStopped,
				Timestamp: time.Now().Format(time.RFC3339),
				Message:   fmt.Sprintf("Container %s is being terminated", container.Name),
				Reason:    "Terminating",
			})
		} else if container.Ready {
			status.State = ContainerStateRunning

			if container.State.Running.StartedAt.Time != (time.Time{}) {
				status.Events = append(status.Events, models.EventRecord{
					Type:      models.EventTypeContainerStarted,
					Timestamp: container.State.Running.StartedAt.Format(time.RFC3339),
					Message:   fmt.Sprintf("Container %s started at %s", container.Name, container.State.Running.StartedAt.Format(time.RFC3339)),
					Reason:    "Started",
				})
			}
		} else {
			// Container is running but not ready (likely failing readiness probes)
			status.State = ContainerStateNotReady
			status.StateReason = "NotReady"
			status.StateMessage = "Container is running but not ready (readiness probe may be failing)"

			status.Events = append(status.Events, models.EventRecord{
				Type:      models.EventTypeUnknown,
				Timestamp: container.State.Running.StartedAt.Format(time.RFC3339),
				Message:   fmt.Sprintf("Container %s started but not ready (readiness probe failing)", container.Name),
				Reason:    "NotReady",
			})
		}

		// Add restart event if applicable
		if container.RestartCount > 0 && !isPodTerminating {
			status.Events = append(status.Events, models.EventRecord{
				Type:      models.EventTypeContainerCreated,
				Timestamp: container.State.Running.StartedAt.Format(time.RFC3339),
				Message:   fmt.Sprintf("Container %s restarted (restart count: %d)", container.Name, container.RestartCount),
				Reason:    "Restarted",
			})
		}

	case container.State.Waiting != nil:
		status.StateReason = container.State.Waiting.Reason
		status.StateMessage = container.State.Waiting.Message

		// Map waiting reasons to more specific states
		reasonLower := strings.ToLower(container.State.Waiting.Reason)
		switch {
		case strings.Contains(reasonLower, "crashloopbackoff"):
			status.State = ContainerStateCrashing
			status.IsCrashing = true
			status.CrashLoopReason = container.State.Waiting.Message
		case strings.Contains(reasonLower, "imagepullbackoff") || strings.Contains(reasonLower, "errimagepull"):
			status.State = ContainerStateImagePullError
		case strings.Contains(reasonLower, "containercreating"):
			status.State = ContainerStateStarting
		case isPodTerminating:
			// If pod is terminating and container is waiting, it's likely terminating
			status.State = ContainerStateTerminating
		default:
			status.State = ContainerStateWaiting
		}

		status.Events = append(status.Events, models.EventRecord{
			Type:      mapWaitingReasonToEventType(container.State.Waiting.Reason),
			Timestamp: time.Now().Format(time.RFC3339),
			Message:   fmt.Sprintf("Container %s is waiting: %s", container.Name, container.State.Waiting.Message),
			Reason:    container.State.Waiting.Reason,
		})

	case container.State.Terminated != nil:
		status.StateReason = container.State.Terminated.Reason
		status.StateMessage = container.State.Terminated.Message
		status.LastExitCode = container.State.Terminated.ExitCode

		// Map termination reasons to more specific states
		reasonLower := strings.ToLower(container.State.Terminated.Reason)
		switch {
		case strings.Contains(reasonLower, "oomkilled"):
			// OOM killed containers are considered crashing unless pod is terminating gracefully
			if isPodTerminating {
				status.State = ContainerStateTerminated
			} else {
				status.State = ContainerStateCrashing
				status.IsCrashing = true
				status.CrashLoopReason = fmt.Sprintf("OOMKilled: %s", container.State.Terminated.Message)
			}
		case container.State.Terminated.ExitCode != 0 && !strings.EqualFold(container.State.Terminated.Reason, "Completed"):
			// Non-zero exit code (except for completed jobs) indicates crashing, unless gracefully terminating
			if isPodTerminating {
				status.State = ContainerStateTerminated
			} else {
				status.State = ContainerStateCrashing
				status.IsCrashing = true
				status.CrashLoopReason = fmt.Sprintf("Terminated with exit code: %d, reason: %s",
					container.State.Terminated.ExitCode, container.State.Terminated.Reason)
			}
		default:
			// All other terminated containers (including graceful shutdowns, completed jobs, etc.)
			status.State = ContainerStateTerminated
		}

		terminatedEvent := models.EventRecord{
			Timestamp: container.State.Terminated.FinishedAt.Format(time.RFC3339),
			Message:   fmt.Sprintf("Container %s terminated with exit code %d: %s", container.Name, container.State.Terminated.ExitCode, container.State.Terminated.Message),
			Reason:    container.State.Terminated.Reason,
		}

		if strings.EqualFold(container.State.Terminated.Reason, "OOMKilled") {
			terminatedEvent.Type = models.EventTypeOOMKilled
		} else {
			terminatedEvent.Type = models.EventTypeContainerStopped
		}

		status.Events = append(status.Events, terminatedEvent)
	}

	// Handle last termination state
	if container.LastTerminationState.Terminated != nil {
		term := container.LastTerminationState.Terminated
		status.LastTermination = fmt.Sprintf(
			"Exit code: %d, Reason: %s, Message: %s, Finished at: %s",
			term.ExitCode,
			term.Reason,
			term.Message,
			term.FinishedAt.Format(time.RFC3339),
		)

		lastTermEvent := models.EventRecord{
			Timestamp: term.FinishedAt.Format(time.RFC3339),
			Message:   fmt.Sprintf("Container %s previous termination: exit code %d, %s", container.Name, term.ExitCode, term.Message),
			Reason:    term.Reason,
		}

		if strings.EqualFold(term.Reason, "OOMKilled") {
			lastTermEvent.Type = models.EventTypeOOMKilled
		} else {
			lastTermEvent.Type = models.EventTypeContainerStopped
		}

		status.Events = append(status.Events, lastTermEvent)
	}

	return status
}

// mapWaitingReasonToEventType maps container waiting reasons to appropriate event types
func mapWaitingReasonToEventType(reason string) models.EventType {
	reasonLower := strings.ToLower(reason)
	switch {
	case strings.Contains(reasonLower, "crashloopbackoff"):
		return models.EventTypeCrashLoopBackOff
	case strings.Contains(reasonLower, "imagepullbackoff") || strings.Contains(reasonLower, "errimagepull"):
		return models.EventTypeImagePullBackOff
	case strings.Contains(reasonLower, "containercreating"):
		return models.EventTypeContainerCreated
	default:
		return models.EventTypeUnknown
	}
}

type InstanceStatus struct {
	KubernetesName  string               `json:"kubernetes_name"`
	Ready           bool                 `json:"ready"`
	RestartCount    int32                `json:"restart_count"`
	State           ContainerState       `json:"state"`
	StateReason     string               `json:"state_reason,omitempty"`
	StateMessage    string               `json:"state_message,omitempty"`
	LastExitCode    int32                `json:"last_exit_code,omitempty"`
	LastTermination string               `json:"last_termination,omitempty"`
	IsCrashing      bool                 `json:"is_crashing"`
	CrashLoopReason string               `json:"crash_loop_reason,omitempty"`
	PodCreatedAt    time.Time            `json:"pod_created_at,omitempty"`
	Events          []models.EventRecord `json:"events,omitempty" nullable:"false"`
}

type PodContainerStatus struct {
	KubernetesName       string           `json:"kubernetes_name"`
	Namespace            string           `json:"namespace"`
	Phase                PodPhase         `json:"phase"`
	PodIP                string           `json:"pod_ip,omitempty"`
	StartTime            string           `json:"start_time,omitempty"`
	CreatedAt            time.Time        `json:"created_at,omitempty"`
	HasCrashingInstances bool             `json:"has_crashing_instances"`
	IsTerminating        bool             `json:"is_terminating"` // Added terminating detection
	Instances            []InstanceStatus `json:"instances" nullable:"false"`
	InstanceDependencies []InstanceStatus `json:"instance_dependencies" nullable:"false"`
	TeamID               uuid.UUID        `json:"team_id"`
	ProjectID            uuid.UUID        `json:"project_id"`
	EnvironmentID        uuid.UUID        `json:"environment_id"`
	ServiceID            uuid.UUID        `json:"service_id"`
}

type SimpleHealthStatus struct {
	Health            InstanceHealth         `json:"health"`
	ExpectedInstances int                    `json:"expected_instances"`
	Instances         []SimpleInstanceStatus `json:"instances" nullable:"false"`
}

type SimpleInstanceStatus struct {
	KubernetesName string               `json:"kubernetes_name"`
	Status         ContainerState       `json:"status"`
	RestartCount   int32                `json:"restart_count"`
	PodCreatedAt   time.Time            `json:"pod_created_at,omitempty"`
	Events         []models.EventRecord `json:"events,omitempty" nullable:"false"`
}

type ContainerState string

const (
	ContainerStateRunning        ContainerState = "running"
	ContainerStateWaiting        ContainerState = "waiting"
	ContainerStateTerminated     ContainerState = "terminated"
	ContainerStateTerminating    ContainerState = "terminating"      // Pod is being terminated (e.g., during scaling down)
	ContainerStateCrashing       ContainerState = "crashing"         // CrashLoopBackOff or repeatedly failing
	ContainerStateNotReady       ContainerState = "not_ready"        // Running but failing readiness probes
	ContainerStateImagePullError ContainerState = "image_pull_error" // Cannot pull container image
	ContainerStateStarting       ContainerState = "starting"         // Container is starting but not ready yet
)

func (u ContainerState) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["ContainerState"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "ContainerState")
		schemaRef.Title = "ContainerState"
		schemaRef.Enum = append(schemaRef.Enum, string(ContainerStateRunning))
		schemaRef.Enum = append(schemaRef.Enum, string(ContainerStateWaiting))
		schemaRef.Enum = append(schemaRef.Enum, string(ContainerStateTerminated))
		schemaRef.Enum = append(schemaRef.Enum, string(ContainerStateTerminating))
		schemaRef.Enum = append(schemaRef.Enum, string(ContainerStateCrashing))
		schemaRef.Enum = append(schemaRef.Enum, string(ContainerStateNotReady))
		schemaRef.Enum = append(schemaRef.Enum, string(ContainerStateImagePullError))
		schemaRef.Enum = append(schemaRef.Enum, string(ContainerStateStarting))
		r.Map()["ContainerState"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/ContainerState"}
}

type InstanceHealth string

const (
	InstanceHealthPending     InstanceHealth = "pending"     // Waiting to be scheduled, or running but not ready yet
	InstanceHealthCrashing    InstanceHealth = "crashing"    // Has crashing instances
	InstanceHealthActive      InstanceHealth = "active"      // All instances running and healthy
	InstanceHealthTerminating InstanceHealth = "terminating" // Pod is being gracefully terminated
)

func (u InstanceHealth) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["InstanceHealth"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "InstanceHealth")
		schemaRef.Title = "InstanceHealth"
		schemaRef.Enum = append(schemaRef.Enum, string(InstanceHealthPending))
		schemaRef.Enum = append(schemaRef.Enum, string(InstanceHealthCrashing))
		schemaRef.Enum = append(schemaRef.Enum, string(InstanceHealthActive))
		schemaRef.Enum = append(schemaRef.Enum, string(InstanceHealthTerminating))
		r.Map()["InstanceHealth"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/InstanceHealth"}
}

type PodPhase string

const (
	PodPending   PodPhase = "pending"
	PodRunning   PodPhase = "running"
	PodSucceeded PodPhase = "succeeded"
	PodFailed    PodPhase = "failed"
	PodUnknown   PodPhase = "unknown"
)

var allPodPhases = []corev1.PodPhase{
	corev1.PodPending,
	corev1.PodRunning,
	corev1.PodSucceeded,
	corev1.PodFailed,
	corev1.PodUnknown,
}

func (u PodPhase) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["PodPhase"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "PodPhase")
		schemaRef.Title = "PodPhase"
		for _, v := range allPodPhases {
			schemaRef.Enum = append(schemaRef.Enum, string(v))
		}
		r.Map()["PodPhase"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/PodPhase"}
}

func (k *KubeClient) GetExpectedInstances(ctx context.Context, namespace string, podName string, client kubernetes.Interface) (int, error) {
	pod, err := client.CoreV1().Pods(namespace).Get(ctx, podName, metav1.GetOptions{})
	if err != nil {
		return 0, fmt.Errorf("failed to get pod: %w", err)
	}

	for _, ownerRef := range pod.OwnerReferences {
		switch strings.ToLower(ownerRef.Kind) {
		case "statefulset":
			sts, err := client.AppsV1().StatefulSets(namespace).Get(ctx, ownerRef.Name, metav1.GetOptions{})
			if err != nil {
				return 0, fmt.Errorf("failed to get statefulset: %w", err)
			}
			return int(*sts.Spec.Replicas), nil

		case "deployment":
			deploy, err := client.AppsV1().Deployments(namespace).Get(ctx, ownerRef.Name, metav1.GetOptions{})
			if err != nil {
				return 0, fmt.Errorf("failed to get deployment: %w", err)
			}
			return int(*deploy.Spec.Replicas), nil

		case "replicaset":
			rs, err := client.AppsV1().ReplicaSets(namespace).Get(ctx, ownerRef.Name, metav1.GetOptions{})
			if err != nil {
				return 0, fmt.Errorf("failed to get replicaset: %w", err)
			}
			return int(*rs.Spec.Replicas), nil

		case "daemonset":
			ds, err := client.AppsV1().DaemonSets(namespace).Get(ctx, ownerRef.Name, metav1.GetOptions{})
			if err != nil {
				return 0, fmt.Errorf("failed to get daemonset: %w", err)
			}
			return int(ds.Status.DesiredNumberScheduled), nil
		}
	}

	return 1, nil
}

func (self *KubeClient) GetSimpleHealthStatus(ctx context.Context, namespace string, labels map[string]string, expectedReplicas *int, client kubernetes.Interface) (*SimpleHealthStatus, error) {
	podStatuses, err := self.GetPodContainerStatusByLabels(ctx, namespace, labels, client)
	if err != nil {
		return nil, fmt.Errorf("failed to get pod statuses: %w", err)
	}

	if len(podStatuses) == 0 {
		return &SimpleHealthStatus{
			Health:            InstanceHealthPending,
			ExpectedInstances: 0,
			Instances:         []SimpleInstanceStatus{},
		}, nil
	}

	var expectedInstances int
	if expectedReplicas != nil {
		expectedInstances = *expectedReplicas
	} else {
		expectedInstances, err = self.GetExpectedInstances(ctx, podStatuses[0].Namespace, podStatuses[0].KubernetesName, client)
		if err != nil {
			return nil, fmt.Errorf("failed to get expected instances: %w", err)
		}
	}

	hasCrashing := false
	hasPending := false
	hasTerminating := false
	readyPodCount := 0
	allInstances := make([]SimpleInstanceStatus, 0, len(podStatuses))

	for _, podStatus := range podStatuses {
		// Check if pod itself is terminating
		if podStatus.IsTerminating {
			hasTerminating = true
		}

		// Check if any containers are crashing
		if podStatus.HasCrashingInstances {
			hasCrashing = true
		}

		// For grouping logic - track pod-level health
		podHasCrashing := false
		podHasPending := false
		podHasTerminating := false
		podReadyContainers := 0
		podTotalMainContainers := len(podStatus.Instances)
		var podState ContainerState
		var podEvents []models.EventRecord
		var maxRestartCount int32

		// Process main containers
		for _, instance := range podStatus.Instances {
			// Collect all events from all containers in this pod
			podEvents = append(podEvents, instance.Events...)

			// Track highest restart count
			if instance.RestartCount > maxRestartCount {
				maxRestartCount = instance.RestartCount
			}

			// Track pod-level states
			switch instance.State {
			case ContainerStateCrashing:
				podHasCrashing = true
				hasCrashing = true
				podState = ContainerStateCrashing // Crashing takes precedence
			case ContainerStateTerminating:
				podHasTerminating = true
				hasTerminating = true
				if podState != ContainerStateCrashing {
					podState = ContainerStateTerminating
				}
			case ContainerStateRunning:
				if instance.Ready {
					podReadyContainers++
				} else {
					podHasPending = true
					hasPending = true
					if podState != ContainerStateCrashing && podState != ContainerStateTerminating {
						podState = ContainerStateNotReady
					}
				}
			case ContainerStateNotReady, ContainerStateWaiting, ContainerStateStarting, ContainerStateImagePullError:
				podHasPending = true
				hasPending = true
				if podState != ContainerStateCrashing && podState != ContainerStateTerminating {
					podState = instance.State
				}
			case ContainerStateTerminated:
				// Terminated containers might be crashing if they have restart counts or failed
				if instance.IsCrashing {
					podHasCrashing = true
					hasCrashing = true
					podState = ContainerStateCrashing
				} else if podState == "" {
					podState = ContainerStateTerminated
				}
			}
		}

		// Process init containers but filter out terminated ones
		for _, instance := range podStatus.InstanceDependencies {
			// Skip terminated init containers as they're expected to be terminated after successful completion
			if instance.State == ContainerStateTerminated && !instance.IsCrashing {
				continue
			}

			// Collect events from init containers that are still relevant
			podEvents = append(podEvents, instance.Events...)

			// Track highest restart count including init containers
			if instance.RestartCount > maxRestartCount {
				maxRestartCount = instance.RestartCount
			}

			// Init containers failing can affect overall health
			switch instance.State {
			case ContainerStateCrashing:
				podHasCrashing = true
				hasCrashing = true
				podState = ContainerStateCrashing
			case ContainerStateTerminating:
				podHasTerminating = true
				hasTerminating = true
				if podState != ContainerStateCrashing {
					podState = ContainerStateTerminating
				}
			case ContainerStateWaiting, ContainerStateStarting, ContainerStateImagePullError:
				podHasPending = true
				hasPending = true
				if podState != ContainerStateCrashing && podState != ContainerStateTerminating {
					podState = instance.State
				}
			case ContainerStateTerminated:
				if instance.IsCrashing {
					podHasCrashing = true
					hasCrashing = true
					podState = ContainerStateCrashing
				}
			}
		}

		// Determine final pod state - if all main containers are ready and running, pod is running
		if !podHasCrashing && !podHasTerminating && !podHasPending && podReadyContainers == podTotalMainContainers && podTotalMainContainers > 0 {
			podState = ContainerStateRunning
			readyPodCount++
		}

		// Create a single SimpleInstanceStatus representing the entire pod
		podInstanceStatus := SimpleInstanceStatus{
			KubernetesName: podStatus.KubernetesName, // Use pod name instead of container name
			Status:         podState,
			RestartCount:   maxRestartCount, // Use highest restart count from all containers
			PodCreatedAt:   podStatus.CreatedAt,
			Events:         podEvents, // Combine events from all containers
		}

		allInstances = append(allInstances, podInstanceStatus)
	}

	// Determine health status based on priority:
	// 1. Crashing takes precedence over everything (indicates real problems)
	// 2. Terminating comes next (planned shutdown/scaling)
	// 3. Pending if any containers are not ready or we don't have enough pod replicas
	// 4. Active only if all expected pod replicas are ready and running
	var health InstanceHealth
	switch {
	case hasCrashing:
		health = InstanceHealthCrashing
	case hasTerminating:
		health = InstanceHealthTerminating
	case hasPending || readyPodCount < expectedInstances:
		health = InstanceHealthPending
	default:
		health = InstanceHealthActive
	}

	// Sort instances by pod creation time descending (newest first)
	sort.Slice(allInstances, func(i, j int) bool {
		return allInstances[i].PodCreatedAt.After(allInstances[j].PodCreatedAt)
	})

	return &SimpleHealthStatus{
		Health:            health,
		ExpectedInstances: expectedInstances,
		Instances:         allInstances,
	}, nil
}

// mapKubernetesPodPhase converts Kubernetes PodPhase to our PodPhase constants
func mapKubernetesPodPhase(kubePhase corev1.PodPhase) PodPhase {
	switch kubePhase {
	case corev1.PodPending:
		return PodPending
	case corev1.PodRunning:
		return PodRunning
	case corev1.PodSucceeded:
		return PodSucceeded
	case corev1.PodFailed:
		return PodFailed
	case corev1.PodUnknown:
		return PodUnknown
	default:
		return PodUnknown
	}
}
