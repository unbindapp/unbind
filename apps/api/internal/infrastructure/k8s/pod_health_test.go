package k8s

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/internal/models"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
)

// K8sTestSuite defines the test suite
type K8sTestSuite struct {
	suite.Suite
	ctx           context.Context
	fakeClient    *fake.Clientset
	kubeClient    *KubeClient
	teamID        uuid.UUID
	projectID     uuid.UUID
	environmentID uuid.UUID
	serviceID     uuid.UUID
	now           metav1.Time
}

// SetupSuite runs before all tests in the suite
func (suite *K8sTestSuite) SetupSuite() {
	suite.ctx = context.Background()
	suite.kubeClient = &KubeClient{}
	suite.teamID = uuid.New()
	suite.projectID = uuid.New()
	suite.environmentID = uuid.New()
	suite.serviceID = uuid.New()
	suite.now = metav1.Now()
}

// SetupTest runs before each test
func (suite *K8sTestSuite) SetupTest() {
	suite.fakeClient = fake.NewSimpleClientset()
}

// TearDownTest runs after each test
func (suite *K8sTestSuite) TearDownTest() {
	suite.fakeClient = nil
}

func (suite *K8sTestSuite) TestContainerStateConstants() {
	tests := []struct {
		name          string
		state         ContainerState
		expectedValue string
	}{
		{"Running", ContainerStateRunning, "running"},
		{"Waiting", ContainerStateWaiting, "waiting"},
		{"Terminated", ContainerStateTerminated, "terminated"},
		{"Terminating", ContainerStateTerminating, "terminating"},
		{"Crashing", ContainerStateCrashing, "crashing"},
		{"Not Ready", ContainerStateNotReady, "not_ready"},
		{"Image Pull Error", ContainerStateImagePullError, "image_pull_error"},
		{"Starting", ContainerStateStarting, "starting"},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			suite.Equal(tt.expectedValue, string(tt.state))
		})
	}
}

func (suite *K8sTestSuite) TestInstanceHealthConstants() {
	tests := []struct {
		name          string
		health        InstanceHealth
		expectedValue string
	}{
		{"Pending", InstanceHealthPending, "pending"},
		{"Crashing", InstanceHealthCrashing, "crashing"},
		{"Active", InstanceHealthActive, "active"},
		{"Terminating", InstanceHealthTerminating, "terminating"},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			suite.Equal(tt.expectedValue, string(tt.health))
		})
	}
}

func (suite *K8sTestSuite) TestPodPhaseConstants() {
	tests := []struct {
		name          string
		phase         PodPhase
		expectedValue string
	}{
		{"Pending", PodPending, "pending"},
		{"Running", PodRunning, "running"},
		{"Succeeded", PodSucceeded, "succeeded"},
		{"Failed", PodFailed, "failed"},
		{"Unknown", PodUnknown, "unknown"},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			suite.Equal(tt.expectedValue, string(tt.phase))
		})
	}
}

func (suite *K8sTestSuite) TestIsPodTerminating() {
	tests := []struct {
		name                string
		pod                 corev1.Pod
		expectedTerminating bool
	}{
		{
			name: "Pod with deletion timestamp",
			pod: corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					DeletionTimestamp: &suite.now,
				},
			},
			expectedTerminating: true,
		},
		{
			name: "Pod in failed state",
			pod: corev1.Pod{
				Status: corev1.PodStatus{
					Phase: corev1.PodFailed,
				},
			},
			expectedTerminating: false,
		},
		{
			name: "Pod with terminating condition",
			pod: corev1.Pod{
				Status: corev1.PodStatus{
					Phase: corev1.PodRunning,
					Conditions: []corev1.PodCondition{
						{
							Type:   corev1.PodReady,
							Status: corev1.ConditionFalse,
							Reason: "PodTerminating",
						},
					},
				},
			},
			expectedTerminating: true,
		},
		{
			name: "Normal running pod",
			pod: corev1.Pod{
				Status: corev1.PodStatus{
					Phase: corev1.PodRunning,
					Conditions: []corev1.PodCondition{
						{
							Type:   corev1.PodReady,
							Status: corev1.ConditionTrue,
							Reason: "PodRunning",
						},
					},
				},
			},
			expectedTerminating: false,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			result := isPodTerminating(tt.pod)
			suite.Equal(tt.expectedTerminating, result)
		})
	}
}

func (suite *K8sTestSuite) TestMapEventType() {
	tests := []struct {
		name         string
		reason       string
		message      string
		expectedType models.EventType
	}{
		{
			name:         "OOM Killed event",
			reason:       "OOMKilled",
			message:      "Container was killed due to out of memory",
			expectedType: models.EventTypeOOMKilled,
		},
		{
			name:         "Image pull backoff",
			reason:       "ImagePullBackOff",
			message:      "Unable to pull image",
			expectedType: models.EventTypeImagePullBackOff,
		},
		{
			name:         "Crash loop backoff",
			reason:       "CrashLoopBackOff",
			message:      "Container keeps crashing",
			expectedType: models.EventTypeCrashLoopBackOff,
		},
		{
			name:         "Container created",
			reason:       "Created",
			message:      "Container created successfully",
			expectedType: models.EventTypeContainerCreated,
		},
		{
			name:         "Container started",
			reason:       "Started",
			message:      "Container started successfully",
			expectedType: models.EventTypeContainerStarted,
		},
		{
			name:         "Container stopped",
			reason:       "Killing",
			message:      "Stopping container",
			expectedType: models.EventTypeContainerStopped,
		},
		{
			name:         "Node not ready",
			reason:       "NodeNotReady",
			message:      "Node is not ready",
			expectedType: models.EventTypeNodeNotReady,
		},
		{
			name:         "Failed scheduling",
			reason:       "FailedScheduling",
			message:      "Failed to schedule pod",
			expectedType: models.EventTypeSchedulingFailed,
		},
		{
			name:         "Unknown event",
			reason:       "CustomReason",
			message:      "Custom message",
			expectedType: models.EventTypeUnknown,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			result := mapEventType(tt.reason, tt.message)
			suite.Equal(tt.expectedType, result)
		})
	}
}

func (suite *K8sTestSuite) TestMapWaitingReasonToEventType() {
	tests := []struct {
		name         string
		reason       string
		expectedType models.EventType
	}{
		{
			name:         "Crash loop backoff",
			reason:       "CrashLoopBackOff",
			expectedType: models.EventTypeCrashLoopBackOff,
		},
		{
			name:         "Image pull backoff",
			reason:       "ImagePullBackOff",
			expectedType: models.EventTypeImagePullBackOff,
		},
		{
			name:         "ErrImagePull",
			reason:       "ErrImagePull",
			expectedType: models.EventTypeImagePullBackOff,
		},
		{
			name:         "Container creating",
			reason:       "ContainerCreating",
			expectedType: models.EventTypeContainerCreated,
		},
		{
			name:         "Unknown waiting reason",
			reason:       "CustomWaitingReason",
			expectedType: models.EventTypeUnknown,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			result := mapWaitingReasonToEventType(tt.reason)
			suite.Equal(tt.expectedType, result)
		})
	}
}

func (suite *K8sTestSuite) TestFilterEventsByPod() {
	podName := "test-pod-123"

	events := []models.EventRecord{
		{
			Type:    models.EventTypeContainerStarted,
			Message: "Pod test-pod-123 started successfully",
			Reason:  "Started",
		},
		{
			Type:    models.EventTypeSchedulingFailed,
			Message: "Pod other-pod-456 failed to start",
			Reason:  "Failed",
		},
		{
			Type:    models.EventTypeContainerStarted,
			Message: "Container in test-pod-123 is running",
			Reason:  "ContainerStarted",
		},
		{
			Type:    models.EventTypeUnknown,
			Message: "Unrelated event message",
			Reason:  "Unrelated",
		},
	}

	filtered := filterEventsByPod(events, podName)

	suite.Len(filtered, 2)
	suite.Contains(filtered[0].Message, podName)
	suite.Contains(filtered[1].Message, podName)
}

func (suite *K8sTestSuite) TestFilterEventsByContainer() {
	containerName := "app-container"

	events := []models.EventRecord{
		{
			Type:    models.EventTypeContainerStarted,
			Message: "Container app-container started",
			Reason:  "ContainerStarted",
		},
		{
			Type:    models.EventTypeSchedulingFailed,
			Message: "Container other-container failed",
			Reason:  "ContainerFailed",
		},
		{
			Type:    models.EventTypeContainerStarted,
			Message: "app-container is healthy",
			Reason:  "HealthCheck",
		},
		{
			Type:    models.EventTypeUnknown,
			Message: "Network error occurred",
			Reason:  "NetworkError",
		},
	}

	filtered := filterEventsByContainer(events, containerName)

	// The function is permissive and includes:
	// 1. Events mentioning the container name directly
	// 2. Events with "container" in message (generic container events)
	// 3. Events with "started" in reason
	// 4. Events with "failed" or "error" in message
	suite.Len(filtered, 4) // All events match the permissive criteria

	// Verify events that specifically mention the container name are included
	hasSpecificContainerEvents := 0
	for _, event := range filtered {
		if strings.Contains(event.Message, containerName) {
			hasSpecificContainerEvents++
		}
	}
	suite.Equal(2, hasSpecificContainerEvents) // Two events specifically mention app-container
}

func (suite *K8sTestSuite) TestExtractContainerStatus() {
	podCreatedAt := time.Now().Add(-10 * time.Minute)

	tests := []struct {
		name               string
		containerStatus    corev1.ContainerStatus
		isPodTerminating   bool
		expectedState      ContainerState
		expectedIsCrashing bool
		expectedReady      bool
	}{
		{
			name: "Running and ready container",
			containerStatus: corev1.ContainerStatus{
				Name:         "app-container",
				Ready:        true,
				RestartCount: 0,
				State: corev1.ContainerState{
					Running: &corev1.ContainerStateRunning{
						StartedAt: metav1.Now(),
					},
				},
			},
			isPodTerminating:   false,
			expectedState:      ContainerStateRunning,
			expectedIsCrashing: false,
			expectedReady:      true,
		},
		{
			name: "Running but not ready container",
			containerStatus: corev1.ContainerStatus{
				Name:         "app-container",
				Ready:        false,
				RestartCount: 0,
				State: corev1.ContainerState{
					Running: &corev1.ContainerStateRunning{
						StartedAt: metav1.Now(),
					},
				},
			},
			isPodTerminating:   false,
			expectedState:      ContainerStateNotReady,
			expectedIsCrashing: false,
			expectedReady:      false,
		},
		{
			name: "Container in crash loop backoff",
			containerStatus: corev1.ContainerStatus{
				Name:         "app-container",
				Ready:        false,
				RestartCount: 5,
				State: corev1.ContainerState{
					Waiting: &corev1.ContainerStateWaiting{
						Reason:  "CrashLoopBackOff",
						Message: "Container keeps crashing",
					},
				},
			},
			isPodTerminating:   false,
			expectedState:      ContainerStateCrashing,
			expectedIsCrashing: true,
			expectedReady:      false,
		},
		{
			name: "Container with image pull error",
			containerStatus: corev1.ContainerStatus{
				Name:         "app-container",
				Ready:        false,
				RestartCount: 0,
				State: corev1.ContainerState{
					Waiting: &corev1.ContainerStateWaiting{
						Reason:  "ImagePullBackOff",
						Message: "Unable to pull image",
					},
				},
			},
			isPodTerminating:   false,
			expectedState:      ContainerStateImagePullError,
			expectedIsCrashing: false,
			expectedReady:      false,
		},
		{
			name: "Container creating",
			containerStatus: corev1.ContainerStatus{
				Name:         "app-container",
				Ready:        false,
				RestartCount: 0,
				State: corev1.ContainerState{
					Waiting: &corev1.ContainerStateWaiting{
						Reason:  "ContainerCreating",
						Message: "Creating container",
					},
				},
			},
			isPodTerminating:   false,
			expectedState:      ContainerStateStarting,
			expectedIsCrashing: false,
			expectedReady:      false,
		},
		{
			name: "OOM killed container",
			containerStatus: corev1.ContainerStatus{
				Name:         "app-container",
				Ready:        false,
				RestartCount: 1,
				State: corev1.ContainerState{
					Terminated: &corev1.ContainerStateTerminated{
						ExitCode: 137,
						Reason:   "OOMKilled",
						Message:  "Container was killed due to memory limit",
					},
				},
			},
			isPodTerminating:   false,
			expectedState:      ContainerStateCrashing,
			expectedIsCrashing: true,
			expectedReady:      false,
		},
		{
			name: "Successfully completed container",
			containerStatus: corev1.ContainerStatus{
				Name:         "app-container",
				Ready:        false,
				RestartCount: 0,
				State: corev1.ContainerState{
					Terminated: &corev1.ContainerStateTerminated{
						ExitCode: 0,
						Reason:   "Completed",
						Message:  "Container completed successfully",
					},
				},
			},
			isPodTerminating:   false,
			expectedState:      ContainerStateTerminated,
			expectedIsCrashing: false,
			expectedReady:      false,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			result := extractContainerStatus(tt.containerStatus, tt.isPodTerminating, podCreatedAt)

			suite.Equal(tt.containerStatus.Name, result.KubernetesName)
			suite.Equal(tt.expectedReady, result.Ready)
			suite.Equal(tt.containerStatus.RestartCount, result.RestartCount)
			suite.Equal(tt.expectedState, result.State)
			suite.Equal(tt.expectedIsCrashing, result.IsCrashing)
			suite.Equal(podCreatedAt, result.PodCreatedAt)
			suite.NotEmpty(result.Events)
		})
	}
}

func (suite *K8sTestSuite) TestInstanceStatusCreation() {
	// Test InstanceStatus struct creation and field validation
	status := InstanceStatus{
		KubernetesName:  "test-container",
		Ready:           true,
		RestartCount:    5,
		State:           ContainerStateRunning,
		StateReason:     "Started",
		StateMessage:    "Container is running",
		LastExitCode:    0,
		LastTermination: "Exit code: 0",
		IsCrashing:      false,
		CrashLoopReason: "",
		PodCreatedAt:    time.Now(),
		Events:          []models.EventRecord{},
	}

	suite.Equal("test-container", status.KubernetesName)
	suite.True(status.Ready)
	suite.Equal(int32(5), status.RestartCount)
	suite.Equal(ContainerStateRunning, status.State)
	suite.Equal("Started", status.StateReason)
	suite.Equal("Container is running", status.StateMessage)
	suite.Equal(int32(0), status.LastExitCode)
	suite.False(status.IsCrashing)
	suite.Empty(status.CrashLoopReason)
	suite.NotNil(status.Events)
}

func (suite *K8sTestSuite) TestPodContainerStatusCreation() {
	// Test PodContainerStatus struct creation and field validation
	status := PodContainerStatus{
		KubernetesName:       "test-pod",
		Namespace:            "default",
		Phase:                PodRunning,
		PodIP:                "10.0.0.1",
		StartTime:            "2023-01-01T00:00:00Z",
		CreatedAt:            time.Now(),
		HasCrashingInstances: false,
		IsTerminating:        false,
		Instances:            []InstanceStatus{},
		InstanceDependencies: []InstanceStatus{},
		TeamID:               suite.teamID,
		ProjectID:            suite.projectID,
		EnvironmentID:        suite.environmentID,
		ServiceID:            suite.serviceID,
	}

	suite.Equal("test-pod", status.KubernetesName)
	suite.Equal("default", status.Namespace)
	suite.Equal(PodRunning, status.Phase)
	suite.Equal("10.0.0.1", status.PodIP)
	suite.Equal("2023-01-01T00:00:00Z", status.StartTime)
	suite.False(status.HasCrashingInstances)
	suite.False(status.IsTerminating)
	suite.Equal(suite.teamID, status.TeamID)
	suite.Equal(suite.projectID, status.ProjectID)
	suite.Equal(suite.environmentID, status.EnvironmentID)
	suite.Equal(suite.serviceID, status.ServiceID)
	suite.NotNil(status.Instances)
	suite.NotNil(status.InstanceDependencies)
}

func (suite *K8sTestSuite) TestSimpleHealthStatusCreation() {
	// Test SimpleHealthStatus struct creation and field validation
	status := SimpleHealthStatus{
		Health:            InstanceHealthActive,
		ExpectedInstances: 3,
		Instances:         []SimpleInstanceStatus{},
	}

	suite.Equal(InstanceHealthActive, status.Health)
	suite.Equal(3, status.ExpectedInstances)
	suite.NotNil(status.Instances)
	suite.Empty(status.Instances)
}

func (suite *K8sTestSuite) TestSimpleInstanceStatusCreation() {
	// Test SimpleInstanceStatus struct creation and field validation
	status := SimpleInstanceStatus{
		KubernetesName: "simple-container",
		Status:         ContainerStateRunning,
		RestartCount:   2,
		PodCreatedAt:   time.Now(),
		Events:         []models.EventRecord{},
	}

	suite.Equal("simple-container", status.KubernetesName)
	suite.Equal(ContainerStateRunning, status.Status)
	suite.Equal(int32(2), status.RestartCount)
	suite.NotNil(status.Events)
}

func (suite *K8sTestSuite) TestPodStatusOptions() {
	// Test struct creation and fields
	options := PodStatusOptions{
		IncludeKubernetesEvents: true,
	}

	suite.True(options.IncludeKubernetesEvents)

	options.IncludeKubernetesEvents = false
	suite.False(options.IncludeKubernetesEvents)
}

func (suite *K8sTestSuite) TestGetPodContainerStatusByLabelsWithFakeClient() {
	pods := []runtime.Object{
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "app-pod-1",
				Namespace: "default",
				Labels: map[string]string{
					"app":                "web-server",
					"unbind-team":        suite.teamID.String(),
					"unbind-project":     suite.projectID.String(),
					"unbind-environment": suite.environmentID.String(),
					"unbind-service":     suite.serviceID.String(),
				},
				CreationTimestamp: metav1.Now(),
			},
			Status: corev1.PodStatus{
				Phase: corev1.PodRunning,
				PodIP: "10.0.0.1",
				StartTime: &metav1.Time{
					Time: time.Now().Add(-5 * time.Minute),
				},
				ContainerStatuses: []corev1.ContainerStatus{
					{
						Name:         "app-container",
						Ready:        true,
						RestartCount: 0,
						State: corev1.ContainerState{
							Running: &corev1.ContainerStateRunning{
								StartedAt: metav1.Now(),
							},
						},
					},
				},
			},
		},
	}

	fakeClient := fake.NewSimpleClientset(pods...)

	statuses, err := suite.kubeClient.GetPodContainerStatusByLabels(
		suite.ctx,
		"default",
		map[string]string{"app": "web-server"},
		fakeClient,
	)
	suite.NoError(err)
	suite.Len(statuses, 1)

	pod1 := statuses[0]
	suite.Equal("app-pod-1", pod1.KubernetesName)
	suite.Equal(PodRunning, pod1.Phase)
	suite.Equal("10.0.0.1", pod1.PodIP)
	suite.Equal(suite.teamID, pod1.TeamID)
	suite.Equal(suite.projectID, pod1.ProjectID)
	suite.Equal(suite.environmentID, pod1.EnvironmentID)
	suite.Equal(suite.serviceID, pod1.ServiceID)
	suite.False(pod1.IsTerminating)
	suite.False(pod1.HasCrashingInstances)
	suite.Len(pod1.Instances, 1)

	container1 := pod1.Instances[0]
	suite.Equal("app-container", container1.KubernetesName)
	suite.True(container1.Ready)
	suite.Equal(int32(0), container1.RestartCount)
	suite.Equal(ContainerStateRunning, container1.State)
	suite.False(container1.IsCrashing)
}

func (suite *K8sTestSuite) TestGetSimpleHealthStatusWithFakeClient() {
	pods := []runtime.Object{
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:              "healthy-pod",
				Namespace:         "default",
				Labels:            map[string]string{"app": "test-app"},
				CreationTimestamp: metav1.Now(),
			},
			Status: corev1.PodStatus{
				Phase: corev1.PodRunning,
				ContainerStatuses: []corev1.ContainerStatus{
					{
						Name:         "app-container",
						Ready:        true,
						RestartCount: 0,
						State: corev1.ContainerState{
							Running: &corev1.ContainerStateRunning{
								StartedAt: metav1.Now(),
							},
						},
					},
				},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:              "crashing-pod",
				Namespace:         "default",
				Labels:            map[string]string{"app": "test-app"},
				CreationTimestamp: metav1.Now(),
			},
			Status: corev1.PodStatus{
				Phase: corev1.PodRunning,
				ContainerStatuses: []corev1.ContainerStatus{
					{
						Name:         "app-container",
						Ready:        false,
						RestartCount: 5,
						State: corev1.ContainerState{
							Waiting: &corev1.ContainerStateWaiting{
								Reason:  "CrashLoopBackOff",
								Message: "Container is crashing",
							},
						},
					},
				},
			},
		},
	}

	fakeClient := fake.NewSimpleClientset(pods...)

	expectedReplicas := 2
	healthStatus, err := suite.kubeClient.GetSimpleHealthStatus(
		suite.ctx,
		"default",
		map[string]string{"app": "test-app"},
		&expectedReplicas,
		fakeClient,
	)
	suite.NoError(err)
	suite.NotNil(healthStatus)

	suite.Equal(2, healthStatus.ExpectedInstances)
	suite.Len(healthStatus.Instances, 2)
	suite.Equal(InstanceHealthCrashing, healthStatus.Health)

	var healthyFound, crashingFound bool
	for _, instance := range healthStatus.Instances {
		if instance.KubernetesName == "healthy-pod" && instance.Status == ContainerStateRunning {
			healthyFound = true
		}
		if instance.KubernetesName == "crashing-pod" && instance.Status == ContainerStateCrashing {
			crashingFound = true
		}
	}

	suite.True(healthyFound)
	suite.True(crashingFound)
}

func (suite *K8sTestSuite) TestMapKubernetesPodPhase() {
	tests := []struct {
		name          string
		kubePhase     corev1.PodPhase
		expectedPhase PodPhase
	}{
		{
			name:          "Kubernetes Pending to our pending",
			kubePhase:     corev1.PodPending,
			expectedPhase: PodPending,
		},
		{
			name:          "Kubernetes Running to our running",
			kubePhase:     corev1.PodRunning,
			expectedPhase: PodRunning,
		},
		{
			name:          "Kubernetes Succeeded to our succeeded",
			kubePhase:     corev1.PodSucceeded,
			expectedPhase: PodSucceeded,
		},
		{
			name:          "Kubernetes Failed to our failed",
			kubePhase:     corev1.PodFailed,
			expectedPhase: PodFailed,
		},
		{
			name:          "Kubernetes Unknown to our unknown",
			kubePhase:     corev1.PodUnknown,
			expectedPhase: PodUnknown,
		},
		{
			name:          "Invalid phase defaults to unknown",
			kubePhase:     corev1.PodPhase("InvalidPhase"),
			expectedPhase: PodUnknown,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			result := mapKubernetesPodPhase(tt.kubePhase)
			suite.Equal(tt.expectedPhase, result)
		})
	}
}

func (suite *K8sTestSuite) TestGetSimpleHealthStatusWithMultiContainerPod() {
	// Test case that mimics the MySQL StatefulSet with init containers and sidecars
	pods := []runtime.Object{
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:              "mysql-pod-0",
				Namespace:         "default",
				Labels:            map[string]string{"app": "mysql"},
				CreationTimestamp: metav1.Now(),
			},
			Status: corev1.PodStatus{
				Phase: corev1.PodRunning,
				// Main containers (mysqld and agent sidecar)
				ContainerStatuses: []corev1.ContainerStatus{
					{
						Name:         "mysqld",
						Ready:        true,
						RestartCount: 0,
						State: corev1.ContainerState{
							Running: &corev1.ContainerStateRunning{
								StartedAt: metav1.Now(),
							},
						},
					},
					{
						Name:         "agent",
						Ready:        true,
						RestartCount: 0,
						State: corev1.ContainerState{
							Running: &corev1.ContainerStateRunning{
								StartedAt: metav1.Now(),
							},
						},
					},
				},
				// Init containers (should be filtered out when terminated successfully)
				InitContainerStatuses: []corev1.ContainerStatus{
					{
						Name:         "copy-moco-init",
						Ready:        false,
						RestartCount: 0,
						State: corev1.ContainerState{
							Terminated: &corev1.ContainerStateTerminated{
								ExitCode: 0,
								Reason:   "Completed",
								Message:  "Init container completed successfully",
							},
						},
					},
					{
						Name:         "moco-init",
						Ready:        false,
						RestartCount: 0,
						State: corev1.ContainerState{
							Terminated: &corev1.ContainerStateTerminated{
								ExitCode: 0,
								Reason:   "Completed",
								Message:  "Init container completed successfully",
							},
						},
					},
				},
			},
		},
	}

	fakeClient := fake.NewSimpleClientset(pods...)

	expectedReplicas := 1
	healthStatus, err := suite.kubeClient.GetSimpleHealthStatus(
		suite.ctx,
		"default",
		map[string]string{"app": "mysql"},
		&expectedReplicas,
		fakeClient,
	)
	suite.NoError(err)
	suite.NotNil(healthStatus)

	// Should return 1 instance (pod-level grouping) instead of 4 (2 main + 2 init containers)
	suite.Equal(1, healthStatus.ExpectedInstances)
	suite.Len(healthStatus.Instances, 1)
	suite.Equal(InstanceHealthActive, healthStatus.Health) // Both main containers are healthy

	// Verify the single pod-level instance
	podInstance := healthStatus.Instances[0]
	suite.Equal("mysql-pod-0", podInstance.KubernetesName) // Pod name, not container name
	suite.Equal(ContainerStateRunning, podInstance.Status) // Pod is running (all main containers healthy)
	suite.Equal(int32(0), podInstance.RestartCount)        // No restarts

	// Events should include events from both main containers but not from terminated init containers
	// (The exact number depends on how many events each container generates, but it should be > 0)
	suite.NotEmpty(podInstance.Events)
}

func (suite *K8sTestSuite) TestGetSimpleHealthStatusWithFailingInitContainer() {
	// Test case with a failing init container (should be included since it's not successfully terminated)
	pods := []runtime.Object{
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:              "pod-with-failing-init",
				Namespace:         "default",
				Labels:            map[string]string{"app": "test-app"},
				CreationTimestamp: metav1.Now(),
			},
			Status: corev1.PodStatus{
				Phase: corev1.PodPending,
				// No main containers running yet due to init container failure
				ContainerStatuses: []corev1.ContainerStatus{},
				// Failing init container
				InitContainerStatuses: []corev1.ContainerStatus{
					{
						Name:         "failing-init",
						Ready:        false,
						RestartCount: 3,
						State: corev1.ContainerState{
							Waiting: &corev1.ContainerStateWaiting{
								Reason:  "CrashLoopBackOff",
								Message: "Init container keeps failing",
							},
						},
					},
				},
			},
		},
	}

	fakeClient := fake.NewSimpleClientset(pods...)

	expectedReplicas := 1
	healthStatus, err := suite.kubeClient.GetSimpleHealthStatus(
		suite.ctx,
		"default",
		map[string]string{"app": "test-app"},
		&expectedReplicas,
		fakeClient,
	)
	suite.NoError(err)
	suite.NotNil(healthStatus)

	// Should show as crashing due to failing init container
	suite.Equal(1, healthStatus.ExpectedInstances)
	suite.Len(healthStatus.Instances, 1)
	suite.Equal(InstanceHealthCrashing, healthStatus.Health)

	// Verify the pod-level instance shows crashing state
	podInstance := healthStatus.Instances[0]
	suite.Equal("pod-with-failing-init", podInstance.KubernetesName)
	suite.Equal(ContainerStateCrashing, podInstance.Status) // Pod is crashing due to init container
	suite.Equal(int32(3), podInstance.RestartCount)         // Restart count from failing init container
}

// TestK8sTestSuite runs the entire test suite
func TestK8sTestSuite(t *testing.T) {
	suite.Run(t, new(K8sTestSuite))
}
