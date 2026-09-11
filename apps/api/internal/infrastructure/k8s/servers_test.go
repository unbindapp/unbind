package k8s

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func serverTestNode(name string, labels map[string]string, ready bool) *corev1.Node {
	readyStatus := corev1.ConditionFalse
	if ready {
		readyStatus = corev1.ConditionTrue
	}
	return &corev1.Node{
		ObjectMeta: metav1.ObjectMeta{Name: name, Labels: labels},
		Status: corev1.NodeStatus{
			Allocatable: corev1.ResourceList{
				corev1.ResourceCPU:    resource.MustParse("4"),
				corev1.ResourceMemory: resource.MustParse("8Gi"),
				corev1.ResourcePods:   resource.MustParse("110"),
			},
			Conditions: []corev1.NodeCondition{
				{Type: corev1.NodeReady, Status: readyStatus},
				{Type: corev1.NodeMemoryPressure, Status: corev1.ConditionFalse},
				{Type: corev1.NodeDiskPressure, Status: corev1.ConditionTrue},
			},
			Addresses: []corev1.NodeAddress{
				{Type: corev1.NodeInternalIP, Address: "10.0.0.1"},
				{Type: corev1.NodeExternalIP, Address: "203.0.113.1"},
			},
			NodeInfo: corev1.NodeSystemInfo{OSImage: "Ubuntu", Architecture: "amd64", KubeletVersion: "v1.36.2+k3s1"},
		},
	}
}

func serverTestPod(name, node string, phase corev1.PodPhase, cpu, memory string) *corev1.Pod {
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"},
		Spec: corev1.PodSpec{
			NodeName: node,
			Containers: []corev1.Container{{
				Name: "app",
				Resources: corev1.ResourceRequirements{Requests: corev1.ResourceList{
					corev1.ResourceCPU:    resource.MustParse(cpu),
					corev1.ResourceMemory: resource.MustParse(memory),
				}},
			}},
		},
		Status: corev1.PodStatus{Phase: phase},
	}
}

func TestListServers(t *testing.T) {
	controlPlane := serverTestNode("cp", map[string]string{"node-role.kubernetes.io/control-plane": "true", "node-role.kubernetes.io/master": "true"}, true)
	worker := serverTestNode("worker", nil, false)
	worker.Spec.Unschedulable = true

	bigInit := serverTestPod("init-heavy", "cp", corev1.PodRunning, "100m", "64Mi")
	bigInit.Spec.InitContainers = []corev1.Container{{
		Name: "init",
		Resources: corev1.ResourceRequirements{Requests: corev1.ResourceList{
			corev1.ResourceCPU:    resource.MustParse("500m"),
			corev1.ResourceMemory: resource.MustParse("32Mi"),
		}},
	}}

	client := fake.NewSimpleClientset(
		controlPlane, worker,
		serverTestPod("running", "cp", corev1.PodRunning, "250m", "256Mi"),
		serverTestPod("pending", "cp", corev1.PodPending, "50m", "128Mi"),
		serverTestPod("done", "cp", corev1.PodSucceeded, "1", "1Gi"),
		serverTestPod("failed", "cp", corev1.PodFailed, "1", "1Gi"),
		serverTestPod("unscheduled", "", corev1.PodPending, "1", "1Gi"),
		bigInit,
		serverTestPod("on-worker", "worker", corev1.PodRunning, "10m", "10Mi"),
	)
	kubeClient := &KubeClient{clientset: client}

	servers, err := kubeClient.ListServers(context.Background())
	require.NoError(t, err)
	require.Len(t, servers, 2)

	cp := servers[0]
	assert.Equal(t, "cp", cp.Name)
	assert.True(t, cp.Ready)
	assert.False(t, cp.Unschedulable)
	assert.Equal(t, []string{"control-plane"}, cp.Roles)
	assert.Equal(t, "10.0.0.1", cp.InternalIP)
	assert.Equal(t, "203.0.113.1", cp.ExternalIP)
	assert.Equal(t, "amd64", cp.Architecture)
	assert.Equal(t, "v1.36.2+k3s1", cp.KubernetesVersion)
	assert.Equal(t, int64(4000), cp.CPUAllocatableMillicores)
	assert.Equal(t, int64(8192), cp.MemoryAllocatableMegabytes)
	assert.Equal(t, int64(110), cp.PodCapacity)
	assert.Equal(t, int64(250+50+500), cp.CPURequestedMillicores, "running + pending + max(init, containers); finished and unscheduled pods excluded")
	assert.Equal(t, int64(256+128+64), cp.MemoryRequestedMegabytes)
	assert.Equal(t, int64(3), cp.PodCount)
	assert.False(t, cp.MemoryPressure)
	assert.True(t, cp.DiskPressure)
	assert.False(t, cp.PIDPressure)

	w := servers[1]
	assert.Equal(t, "worker", w.Name)
	assert.False(t, w.Ready)
	assert.True(t, w.Unschedulable)
	assert.Equal(t, []string{"worker"}, w.Roles)
	assert.Equal(t, int64(10), w.CPURequestedMillicores)
	assert.Equal(t, int64(10), w.MemoryRequestedMegabytes)
	assert.Equal(t, int64(1), w.PodCount)
}
