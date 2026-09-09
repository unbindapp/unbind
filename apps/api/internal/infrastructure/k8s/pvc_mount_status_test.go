package k8s

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/models"
	corev1 "k8s.io/api/core/v1"
)

func podInPhase(phase corev1.PodPhase) corev1.Pod {
	return corev1.Pod{Status: corev1.PodStatus{Phase: phase}}
}

func serviceWith(replicas int32, deploymentStatus *schema.DeploymentStatus) *ent.Service {
	service := &ent.Service{}
	service.Edges.ServiceConfig = &ent.ServiceConfig{Replicas: replicas}
	if deploymentStatus != nil {
		service.Edges.CurrentDeployment = &ent.Deployment{Status: *deploymentStatus}
	}
	return service
}

func TestResolveMountStatus(t *testing.T) {
	serviceID := uuid.New()
	succeeded := schema.DeploymentStatusBuildSucceeded
	removed := schema.DeploymentStatusRemoved
	running := []corev1.Pod{podInPhase(corev1.PodRunning)}
	pending := []corev1.Pod{podInPhase(corev1.PodPending)}
	terminating := []corev1.Pod{podInPhase(corev1.PodRunning)}

	tests := []struct {
		name      string
		serviceID *uuid.UUID
		service   *ent.Service
		pods      []corev1.Pod
		want      models.PVCMountStatus
	}{
		{"unbound with no pods", nil, nil, nil, models.PVCMountStatusUnattached},
		{"unbound with old pods still terminating", nil, nil, terminating, models.PVCMountStatusDetaching},
		{"bound with a running pod", &serviceID, serviceWith(1, &succeeded), running, models.PVCMountStatusMounted},
		{"bound before the service row commits", &serviceID, nil, nil, models.PVCMountStatusAttaching},
		{"bound to a service never deployed", &serviceID, serviceWith(1, nil), nil, models.PVCMountStatusAwaitingDeployment},
		{"bound to a service whose deployment was removed", &serviceID, serviceWith(1, &removed), nil, models.PVCMountStatusAwaitingDeployment},
		{"bound to a service scaled to zero", &serviceID, serviceWith(0, &succeeded), nil, models.PVCMountStatusAwaitingDeployment},
		{"scaled to zero while pods still terminate", &serviceID, serviceWith(0, &succeeded), pending, models.PVCMountStatusAttaching},
		{"bound with pods pending", &serviceID, serviceWith(1, &succeeded), pending, models.PVCMountStatusAttaching},
		{"bound with no pods yet", &serviceID, serviceWith(1, &succeeded), nil, models.PVCMountStatusAttaching},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resolveMountStatus(tt.serviceID, tt.service, tt.pods, mountBlockingPods(tt.pods))
			assert.Equal(t, tt.want, got)
		})
	}
}
