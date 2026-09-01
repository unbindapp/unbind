package deployments_service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
	"github.com/unbindapp/unbind-api/internal/models"
	mocks_infrastructure_k8s "github.com/unbindapp/unbind-api/mocks/infrastructure/k8s"
	unbindv1 "github.com/unbindapp/unbind-operator/api/v1"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sschema "k8s.io/apimachinery/pkg/runtime/schema"
)

func podStatus(deploymentID uuid.UUID, state k8s.ContainerState, ready, crashing bool) k8s.PodContainerStatus {
	return k8s.PodContainerStatus{
		KubernetesName:       "pod",
		DeploymentID:         deploymentID,
		HasCrashingInstances: crashing,
		Instances: []k8s.InstanceStatus{
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

func TestCalculateInstanceData(t *testing.T) {
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
			expectedEvents:   1,
		},
		{
			name:             "only stale pods past grace is launch error",
			statuses:         []k8s.PodContainerStatus{podStatus(staleID, k8s.ContainerStateRunning, true, false)},
			expectedReplicas: 1,
			deployment:       currentDeployment(old),
			expectedStatus:   schema.DeploymentStatusLaunchError,
			expectedEvents:   1,
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
			expectedEvents:   1,
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
			expectedEvents:   2,
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
			expectedEvents:   2,
		},
		{
			name:             "scale to zero with stale pod is not launch error",
			statuses:         []k8s.PodContainerStatus{podStatus(staleID, k8s.ContainerStateRunning, true, false)},
			expectedReplicas: 0,
			deployment:       currentDeployment(old),
			expectedStatus:   schema.DeploymentStatusActive,
			expectedEvents:   1,
		},
		{
			name:             "removed deployment reports removed even with lingering pods",
			statuses:         []k8s.PodContainerStatus{podStatus(currentID, k8s.ContainerStateRunning, true, false)},
			expectedReplicas: 1,
			deployment:       removedDeployment(old),
			expectedStatus:   schema.DeploymentStatusRemoved,
			expectedEvents:   0,
		},
	}

	svc := &DeploymentService{}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svc.calculateInstanceData(tt.statuses, tt.expectedReplicas, tt.deployment, tt.isDatabase)

			assert.Equal(t, tt.expectedStatus, result.Status)
			assert.Len(t, result.InstanceEvents, tt.expectedEvents)
			if tt.expectReason {
				assert.NotEmpty(t, result.CrashingReasons)
			}
		})
	}
}

func TestApplyDatabaseCRStatus(t *testing.T) {
	ctx := context.Background()
	namespace := "team-ns"
	dbService := &ent.Service{ID: uuid.New(), Type: schema.ServiceTypeDatabase, KubernetesName: "my-redis"}

	statusWith := func(reason, message string) *unbindv1.ServiceStatus {
		return &unbindv1.ServiceStatus{
			Conditions: []metav1.Condition{
				{Type: unbindv1.ConditionTypeDatabaseReady, Status: metav1.ConditionFalse, Reason: reason, Message: message},
			},
		}
	}

	tests := []struct {
		name            string
		service         *ent.Service
		crStatus        *unbindv1.ServiceStatus
		crErr           error
		initialStatus   schema.DeploymentStatus
		expectedStatus  schema.DeploymentStatus
		expectedMessage string
	}{
		{
			name:            "failed release keeps active running with message",
			service:         dbService,
			crStatus:        statusWith(unbindv1.DatabaseReasonFailed, "upgrade retries exhausted"),
			initialStatus:   schema.DeploymentStatusActive,
			expectedStatus:  schema.DeploymentStatusActive,
			expectedMessage: "upgrade retries exhausted",
		},
		{
			name:            "failed release overrides launching",
			service:         dbService,
			crStatus:        statusWith(unbindv1.DatabaseReasonFailed, "upgrade retries exhausted"),
			initialStatus:   schema.DeploymentStatusLaunching,
			expectedStatus:  schema.DeploymentStatusLaunchError,
			expectedMessage: "upgrade retries exhausted",
		},
		{
			name:            "failed release does not mask crashing",
			service:         dbService,
			crStatus:        statusWith(unbindv1.DatabaseReasonFailed, "upgrade retries exhausted"),
			initialStatus:   schema.DeploymentStatusCrashing,
			expectedStatus:  schema.DeploymentStatusCrashing,
			expectedMessage: "upgrade retries exhausted",
		},
		{
			name:            "progressing release downgrades active",
			service:         dbService,
			crStatus:        statusWith(unbindv1.DatabaseReasonProgressing, "helm upgrade in progress"),
			initialStatus:   schema.DeploymentStatusActive,
			expectedStatus:  schema.DeploymentStatusLaunching,
			expectedMessage: "helm upgrade in progress",
		},
		{
			name:           "ready release is a no-op",
			service:        dbService,
			crStatus:       statusWith(unbindv1.DatabaseReasonReady, ""),
			initialStatus:  schema.DeploymentStatusActive,
			expectedStatus: schema.DeploymentStatusActive,
		},
		{
			name:           "missing status is a no-op",
			service:        dbService,
			crStatus:       nil,
			initialStatus:  schema.DeploymentStatusActive,
			expectedStatus: schema.DeploymentStatusActive,
		},
		{
			name:           "missing CR is a no-op",
			service:        dbService,
			crErr:          kerrors.NewNotFound(k8sschema.GroupResource{Group: "unbind.unbind.app", Resource: "services"}, "my-redis"),
			initialStatus:  schema.DeploymentStatusActive,
			expectedStatus: schema.DeploymentStatusActive,
		},
		{
			name:           "non-database service is a no-op",
			service:        &ent.Service{ID: uuid.New(), Type: schema.ServiceTypeGithub},
			initialStatus:  schema.DeploymentStatusActive,
			expectedStatus: schema.DeploymentStatusActive,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			k8sMock := mocks_infrastructure_k8s.NewKubeClientMock(t)
			if tt.service.Type == schema.ServiceTypeDatabase {
				k8sMock.EXPECT().GetUnbindServiceStatus(ctx, namespace, tt.service.KubernetesName).Return(tt.crStatus, tt.crErr)
			}

			svc := &DeploymentService{k8s: k8sMock}
			data := &ServiceInstanceData{Status: tt.initialStatus}
			svc.applyDatabaseCRStatus(ctx, tt.service, namespace, data)

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
