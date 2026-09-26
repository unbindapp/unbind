package deployments_service

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
	unbindv1 "github.com/unbindapp/unbind-operator/api/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func podStatus(deploymentID uuid.UUID, state k8s.ContainerState, ready, crashing bool) k8s.PodContainerStatus {
	return k8s.PodContainerStatus{
		KubernetesName:        "pod",
		DeploymentID:          deploymentID,
		HasCrashingContainers: crashing,
		Containers: []k8s.ContainerStatus{
			{
				KubernetesName: "container",
				Ready:          ready,
				State:          state,
				IsCrashing:     crashing,
				Events: []models.EventRecord{
					{Type: models.EventTypeContainerStarted, Message: "event from " + deploymentID.String()},
				},
			},
		},
	}
}

func launchErrorPodStatus(deploymentID uuid.UUID, state k8s.ContainerState, reason string) k8s.PodContainerStatus {
	status := podStatus(deploymentID, state, false, false)
	status.Containers[0].LaunchErrorReason = reason
	status.Containers[0].Events = []models.EventRecord{
		{Type: models.EventTypeImagePullBackOff, Message: "Container container is waiting: " + reason},
	}
	return status
}

func TestCalculateReplicaData(t *testing.T) {
	currentID := uuid.New()
	staleID := uuid.New()
	now := time.Now()
	old := now.Add(-30 * time.Minute)

	currentDeployment := func(completedAt time.Time) *ent.Deployment {
		return &ent.Deployment{ID: currentID, CreatedAt: completedAt, CompletedAt: &completedAt}
	}

	removedDeployment := func(completedAt time.Time) *ent.Deployment {
		d := currentDeployment(completedAt)
		d.Status = schema.DeploymentStatusRemoved
		return d
	}

	tests := []struct {
		name             string
		statuses         []k8s.PodContainerStatus
		expectedReplicas int32
		deployment       *ent.Deployment
		isDatabase       bool
		expectedStatus   schema.DeploymentStatus
		expectedEvents   int
		expectReason     bool
		expectedReasons  []string
	}{
		{
			name:             "no deployment labels keeps legacy behavior",
			statuses:         []k8s.PodContainerStatus{podStatus(uuid.Nil, k8s.ContainerStateRunning, true, false)},
			expectedReplicas: 1,
			deployment:       currentDeployment(now),
			expectedStatus:   schema.DeploymentStatusActive,
			expectedEvents:   1,
		},
		{
			name:             "nil current deployment keeps legacy behavior",
			statuses:         []k8s.PodContainerStatus{podStatus(staleID, k8s.ContainerStateRunning, true, false)},
			expectedReplicas: 1,
			deployment:       nil,
			expectedStatus:   schema.DeploymentStatusActive,
			expectedEvents:   1,
		},
		{
			name:             "matching pod ready is active",
			statuses:         []k8s.PodContainerStatus{podStatus(currentID, k8s.ContainerStateRunning, true, false)},
			expectedReplicas: 1,
			deployment:       currentDeployment(now),
			expectedStatus:   schema.DeploymentStatusActive,
			expectedEvents:   1,
		},
		{
			name:             "only stale pods within grace is launching",
			statuses:         []k8s.PodContainerStatus{podStatus(staleID, k8s.ContainerStateRunning, true, false)},
			expectedReplicas: 1,
			deployment:       currentDeployment(now),
			expectedStatus:   schema.DeploymentStatusLaunching,
			expectedEvents:   0,
		},
		{
			name:             "only stale pods past grace is launch error",
			statuses:         []k8s.PodContainerStatus{podStatus(staleID, k8s.ContainerStateRunning, true, false)},
			expectedReplicas: 1,
			deployment:       currentDeployment(old),
			expectedStatus:   schema.DeploymentStatusLaunchError,
			expectedEvents:   0,
			expectReason:     true,
		},
		{
			name:             "database ignores stale deployment label past grace",
			statuses:         []k8s.PodContainerStatus{podStatus(staleID, k8s.ContainerStateRunning, true, false)},
			expectedReplicas: 1,
			deployment:       currentDeployment(old),
			isDatabase:       true,
			expectedStatus:   schema.DeploymentStatusActive,
			expectedEvents:   1,
		},
		{
			name:             "stale crashing pod past grace is launch error not crashing",
			statuses:         []k8s.PodContainerStatus{podStatus(staleID, k8s.ContainerStateCrashing, false, true)},
			expectedReplicas: 1,
			deployment:       currentDeployment(old),
			expectedStatus:   schema.DeploymentStatusLaunchError,
			expectedEvents:   0,
			expectReason:     true,
		},
		{
			name: "stale crashing pod does not taint healthy current rollout",
			statuses: []k8s.PodContainerStatus{
				podStatus(currentID, k8s.ContainerStateRunning, true, false),
				podStatus(staleID, k8s.ContainerStateCrashing, false, true),
			},
			expectedReplicas: 1,
			deployment:       currentDeployment(old),
			expectedStatus:   schema.DeploymentStatusActive,
			expectedEvents:   1,
		},
		{
			name: "crashing current pod is crashing",
			statuses: []k8s.PodContainerStatus{
				podStatus(currentID, k8s.ContainerStateCrashing, false, true),
				podStatus(staleID, k8s.ContainerStateRunning, true, false),
			},
			expectedReplicas: 1,
			deployment:       currentDeployment(old),
			expectedStatus:   schema.DeploymentStatusCrashing,
			expectedEvents:   1,
		},
		{
			name:             "scale to zero with stale pod is not launch error",
			statuses:         []k8s.PodContainerStatus{podStatus(staleID, k8s.ContainerStateRunning, true, false)},
			expectedReplicas: 0,
			deployment:       currentDeployment(old),
			expectedStatus:   schema.DeploymentStatusActive,
			expectedEvents:   0,
		},
		{
			name:             "removed deployment reports removed even with lingering pods",
			statuses:         []k8s.PodContainerStatus{podStatus(currentID, k8s.ContainerStateRunning, true, false)},
			expectedReplicas: 1,
			deployment:       removedDeployment(old),
			expectedStatus:   schema.DeploymentStatusRemoved,
			expectedEvents:   0,
		},
		{
			name: "image pull error is a launch error with the pull failure as reason",
			statuses: []k8s.PodContainerStatus{
				launchErrorPodStatus(currentID, k8s.ContainerStateImagePullError, "Couldn't pull the image: registry served 0 bytes"),
			},
			expectedReplicas: 1,
			deployment:       currentDeployment(now),
			expectedStatus:   schema.DeploymentStatusLaunchError,
			expectedEvents:   1,
			expectedReasons:  []string{"Couldn't pull the image: registry served 0 bytes"},
		},
		{
			name: "image pull error on stale pod is ignored",
			statuses: []k8s.PodContainerStatus{
				podStatus(currentID, k8s.ContainerStateRunning, true, false),
				launchErrorPodStatus(staleID, k8s.ContainerStateImagePullError, "Couldn't pull the image: not found"),
			},
			expectedReplicas: 1,
			deployment:       currentDeployment(now),
			expectedStatus:   schema.DeploymentStatusActive,
			expectedEvents:   1,
			expectedReasons:  []string{},
		},
		{
			name: "container start error is a launch error",
			statuses: []k8s.PodContainerStatus{
				launchErrorPodStatus(currentID, k8s.ContainerStateLaunchError, "Couldn't start the container: secret \"db\" not found"),
			},
			expectedReplicas: 1,
			deployment:       currentDeployment(now),
			expectedStatus:   schema.DeploymentStatusLaunchError,
			expectedEvents:   1,
			expectedReasons:  []string{"Couldn't start the container: secret \"db\" not found"},
		},
		{
			name: "init container image pull error is a launch error",
			statuses: []k8s.PodContainerStatus{
				{
					KubernetesName: "pod",
					DeploymentID:   currentID,
					InitContainers: []k8s.ContainerStatus{
						{KubernetesName: "init", State: k8s.ContainerStateImagePullError, LaunchErrorReason: "Couldn't pull the image: not found"},
					},
				},
			},
			expectedReplicas: 1,
			deployment:       currentDeployment(now),
			expectedStatus:   schema.DeploymentStatusLaunchError,
			expectedEvents:   0,
			expectedReasons:  []string{"Couldn't pull the image: not found"},
		},
		{
			name: "unschedulable pod is a launch error",
			statuses: []k8s.PodContainerStatus{
				{KubernetesName: "pod", DeploymentID: currentID, LaunchErrorReason: "No server can run this replica: 0/1 nodes are available: 1 Insufficient memory."},
			},
			expectedReplicas: 1,
			deployment:       currentDeployment(now),
			expectedStatus:   schema.DeploymentStatusLaunchError,
			expectedEvents:   0,
			expectedReasons:  []string{"No server can run this replica: 0/1 nodes are available: 1 Insufficient memory."},
		},
		{
			name: "replicas failing the same way share one reason",
			statuses: []k8s.PodContainerStatus{
				launchErrorPodStatus(currentID, k8s.ContainerStateImagePullError, "Couldn't pull the image: not found"),
				launchErrorPodStatus(currentID, k8s.ContainerStateImagePullError, "Couldn't pull the image: not found"),
				launchErrorPodStatus(currentID, k8s.ContainerStateImagePullError, "Couldn't pull the image: unauthorized"),
			},
			expectedReplicas: 3,
			deployment:       currentDeployment(now),
			expectedStatus:   schema.DeploymentStatusLaunchError,
			expectedEvents:   3,
			expectedReasons:  []string{"Couldn't pull the image: not found", "Couldn't pull the image: unauthorized"},
		},
		{
			name: "crashing wins over launch error and keeps both reasons",
			statuses: []k8s.PodContainerStatus{
				podStatus(currentID, k8s.ContainerStateCrashing, false, true),
				launchErrorPodStatus(currentID, k8s.ContainerStateImagePullError, "Couldn't pull the image: not found"),
			},
			expectedReplicas: 2,
			deployment:       currentDeployment(now),
			expectedStatus:   schema.DeploymentStatusCrashing,
			expectedEvents:   2,
			expectedReasons:  []string{"Couldn't pull the image: not found"},
		},
		{
			name: "scheduling failed event without pod reason is a launch error with the event message",
			statuses: []k8s.PodContainerStatus{
				{
					KubernetesName: "pod",
					DeploymentID:   currentID,
					Containers: []k8s.ContainerStatus{
						{
							KubernetesName: "container",
							State:          k8s.ContainerStateWaiting,
							Events:         []models.EventRecord{{Type: models.EventTypeSchedulingFailed, Message: "0/1 nodes are available"}},
						},
					},
				},
			},
			expectedReplicas: 1,
			deployment:       currentDeployment(now),
			expectedStatus:   schema.DeploymentStatusLaunchError,
			expectedEvents:   1,
			expectedReasons:  []string{"0/1 nodes are available"},
		},
	}

	svc := &DeploymentService{}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svc.calculateReplicaData(tt.statuses, tt.expectedReplicas, tt.deployment, tt.isDatabase)

			assert.Equal(t, tt.expectedStatus, result.Status)
			assert.Len(t, result.ReplicaEvents, tt.expectedEvents)
			if tt.expectReason {
				assert.NotEmpty(t, result.CrashingReasons)
			}
			if tt.expectedReasons != nil {
				assert.Equal(t, tt.expectedReasons, result.CrashingReasons)
			}
		})
	}
}

func TestApplyServiceState(t *testing.T) {
	const generation = int64(7)

	database := func(reason, message string) *k8s.UnbindServiceState {
		return &k8s.UnbindServiceState{
			Generation: generation,
			Status: unbindv1.ServiceStatus{Conditions: []metav1.Condition{
				{Type: unbindv1.ConditionTypeDatabaseReady, Status: metav1.ConditionFalse, Reason: reason, Message: message},
			}},
		}
	}
	reconcile := func(status metav1.ConditionStatus, observed int64, message string) *k8s.UnbindServiceState {
		return &k8s.UnbindServiceState{
			Generation: generation,
			Status: unbindv1.ServiceStatus{Conditions: []metav1.Condition{
				{Type: unbindv1.ConditionTypeReconciled, Status: status, ObservedGeneration: observed, Message: message},
			}},
		}
	}
	volumeError := "volume name must be no more than 63 characters"

	tests := []struct {
		name            string
		state           *k8s.UnbindServiceState
		isDatabase      bool
		initialStatus   schema.DeploymentStatus
		expectedStatus  schema.DeploymentStatus
		expectedMessage string
	}{
		{
			name:            "failed release keeps active running with message",
			state:           database(unbindv1.DatabaseReasonFailed, "upgrade retries exhausted"),
			isDatabase:      true,
			initialStatus:   schema.DeploymentStatusActive,
			expectedStatus:  schema.DeploymentStatusActive,
			expectedMessage: "upgrade retries exhausted",
		},
		{
			name:            "failed release overrides launching",
			state:           database(unbindv1.DatabaseReasonFailed, "upgrade retries exhausted"),
			isDatabase:      true,
			initialStatus:   schema.DeploymentStatusLaunching,
			expectedStatus:  schema.DeploymentStatusLaunchError,
			expectedMessage: "upgrade retries exhausted",
		},
		{
			name:            "failed release does not mask crashing",
			state:           database(unbindv1.DatabaseReasonFailed, "upgrade retries exhausted"),
			isDatabase:      true,
			initialStatus:   schema.DeploymentStatusCrashing,
			expectedStatus:  schema.DeploymentStatusCrashing,
			expectedMessage: "upgrade retries exhausted",
		},
		{
			name:            "progressing release downgrades active",
			state:           database(unbindv1.DatabaseReasonProgressing, "helm upgrade in progress"),
			isDatabase:      true,
			initialStatus:   schema.DeploymentStatusActive,
			expectedStatus:  schema.DeploymentStatusLaunching,
			expectedMessage: "helm upgrade in progress",
		},
		{
			name:           "ready release is a no-op",
			state:          database(unbindv1.DatabaseReasonReady, ""),
			isDatabase:     true,
			initialStatus:  schema.DeploymentStatusActive,
			expectedStatus: schema.DeploymentStatusActive,
		},
		{
			name:           "missing CR is a no-op",
			state:          nil,
			isDatabase:     true,
			initialStatus:  schema.DeploymentStatusActive,
			expectedStatus: schema.DeploymentStatusActive,
		},
		{
			name:           "database condition is ignored for other services",
			state:          database(unbindv1.DatabaseReasonProgressing, "helm upgrade in progress"),
			initialStatus:  schema.DeploymentStatusActive,
			expectedStatus: schema.DeploymentStatusActive,
		},
		{
			name:            "spec the operator could not apply fails while the old pod is healthy",
			state:           reconcile(metav1.ConditionFalse, generation, volumeError),
			initialStatus:   schema.DeploymentStatusLaunching,
			expectedStatus:  schema.DeploymentStatusLaunchError,
			expectedMessage: "Couldn't apply the deployment: " + volumeError,
		},
		{
			name:            "unapplied spec fails a database too",
			state:           reconcile(metav1.ConditionFalse, generation, volumeError),
			isDatabase:      true,
			initialStatus:   schema.DeploymentStatusActive,
			expectedStatus:  schema.DeploymentStatusLaunchError,
			expectedMessage: "Couldn't apply the deployment: " + volumeError,
		},
		{
			name:           "failure of an older spec is ignored",
			state:          reconcile(metav1.ConditionFalse, generation-1, volumeError),
			initialStatus:  schema.DeploymentStatusLaunching,
			expectedStatus: schema.DeploymentStatusLaunching,
		},
		{
			name:           "applied spec is a no-op",
			state:          reconcile(metav1.ConditionTrue, generation, "Resources are applied"),
			initialStatus:  schema.DeploymentStatusActive,
			expectedStatus: schema.DeploymentStatusActive,
		},
		{
			name:           "removed deployment stays removed",
			state:          reconcile(metav1.ConditionFalse, generation, volumeError),
			initialStatus:  schema.DeploymentStatusRemoved,
			expectedStatus: schema.DeploymentStatusRemoved,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data := &ServiceReplicaData{Status: tt.initialStatus}
			applyServiceState(tt.state, tt.isDatabase, data)

			assert.Equal(t, tt.expectedStatus, data.Status)
			assert.Equal(t, tt.expectedMessage, data.StatusMessage)
		})
	}
}

func TestDeploymentGraceAnchor(t *testing.T) {
	created := time.Now().Add(-1 * time.Hour)
	queued := created.Add(5 * time.Minute)
	started := created.Add(10 * time.Minute)
	completed := created.Add(15 * time.Minute)

	assert.Equal(t, created, deploymentGraceAnchor(&ent.Deployment{CreatedAt: created}))
	assert.Equal(t, queued, deploymentGraceAnchor(&ent.Deployment{CreatedAt: created, QueuedAt: &queued}))
	assert.Equal(t, started, deploymentGraceAnchor(&ent.Deployment{CreatedAt: created, QueuedAt: &queued, StartedAt: &started}))
	assert.Equal(t, completed, deploymentGraceAnchor(&ent.Deployment{CreatedAt: created, QueuedAt: &queued, StartedAt: &started, CompletedAt: &completed}))
}
