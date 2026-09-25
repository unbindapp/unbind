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

func serviceWith(deploymentStatus *schema.DeploymentStatus) *ent.Service {
	service := &ent.Service{Type: schema.ServiceTypeDockerimage}
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

	database := serviceWith(&succeeded)
	database.Type = schema.ServiceTypeDatabase

	tests := []struct {
		name              string
		serviceID         *uuid.UUID
		service           *ent.Service
		claimedByPodsOnly bool
		pods              []corev1.Pod
		want              models.PVCMountStatus
	}{
		{"unbound with no pods", nil, nil, false, nil, models.PVCMountStatusUnattached},
		{"unbound with old pods still terminating", nil, nil, false, terminating, models.PVCMountStatusDetaching},
		{"bound with a running pod", &serviceID, serviceWith(&succeeded), false, running, models.PVCMountStatusMounted},
		{"bound before the service row commits", &serviceID, nil, false, nil, models.PVCMountStatusAttaching},
		{"bound to a service never deployed", &serviceID, serviceWith(nil), false, nil, models.PVCMountStatusAwaitingDeployment},
		{"bound to a service whose deployment was removed", &serviceID, serviceWith(&removed), false, nil, models.PVCMountStatusAwaitingDeployment},
		{"bound with pods pending", &serviceID, serviceWith(&succeeded), false, pending, models.PVCMountStatusAttaching},
		{"bound with no pods yet", &serviceID, serviceWith(&succeeded), false, nil, models.PVCMountStatusAttaching},
		{"unmounted while the old pod still runs", &serviceID, serviceWith(&succeeded), true, running, models.PVCMountStatusDetaching},
		{"database on its operator's storage", &serviceID, database, true, running, models.PVCMountStatusMounted},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resolveMountStatus(tt.serviceID, tt.service, tt.claimedByPodsOnly, tt.pods, mountBlockingPods(tt.pods))
			assert.Equal(t, tt.want, got)
		})
	}
}
