package k8s

import (
	"testing"

	"github.com/stretchr/testify/assert"
	unbindv1 "github.com/unbindapp/unbind-operator/api/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestWithPullingPrepullPods(t *testing.T) {
	waiting := func(reason string) corev1.ContainerStatus {
		return corev1.ContainerStatus{State: corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{Reason: reason}}}
	}
	startError := corev1.ContainerStatus{State: corev1.ContainerState{Terminated: &corev1.ContainerStateTerminated{Reason: "StartError", ExitCode: 128}}}
	prepull := func(name string, phase corev1.PodPhase, statuses ...corev1.ContainerStatus) corev1.Pod {
		return corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: name, Labels: map[string]string{unbindv1.PrepullLabel: "true"}},
			Status:     corev1.PodStatus{Phase: phase, ContainerStatuses: statuses},
		}
	}
	replica := corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "replica"},
		Status:     corev1.PodStatus{Phase: corev1.PodFailed, ContainerStatuses: []corev1.ContainerStatus{startError}},
	}

	kept := withPullingPrepullPods([]corev1.Pod{
		replica,
		prepull("scheduled", corev1.PodPending),
		prepull("pulling", corev1.PodPending, waiting("ContainerCreating")),
		prepull("pull-failed", corev1.PodPending, waiting("ImagePullBackOff")),
		prepull("one-image-left", corev1.PodPending, startError, waiting("ContainerCreating")),
		prepull("pulled", corev1.PodFailed, startError),
		prepull("pulled-before-phase", corev1.PodPending, startError),
	})

	names := make([]string, 0, len(kept))
	for _, pod := range kept {
		names = append(names, pod.Name)
	}
	assert.Equal(t, []string{"replica", "scheduled", "pulling", "pull-failed", "one-image-left"}, names)
	assert.Len(t, kept[0].Status.ContainerStatuses, 1, "a replica keeps its failed containers")
	assert.Equal(t, []corev1.ContainerStatus{waiting("ContainerCreating")}, kept[4].Status.ContainerStatuses)
}
