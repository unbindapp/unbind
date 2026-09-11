package k8s

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/unbindapp/unbind-api/internal/models"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const nodeRoleLabelPrefix = "node-role.kubernetes.io/"

// ListServers returns every node with its allocatable capacity and the requests already scheduled on it
func (self *KubeClient) ListServers(ctx context.Context) ([]*models.ServerResponse, error) {
	nodes, err := self.clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list nodes: %w", err)
	}

	pods, err := self.clientset.CoreV1().Pods(metav1.NamespaceAll).List(ctx, metav1.ListOptions{
		FieldSelector: "status.phase!=Succeeded,status.phase!=Failed",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %w", err)
	}

	type usage struct {
		cpu, memory, pods int64
	}
	requested := make(map[string]*usage, len(nodes.Items))
	for i := range pods.Items {
		pod := &pods.Items[i]
		if pod.Spec.NodeName == "" || isTerminated(pod) {
			continue
		}
		u := requested[pod.Spec.NodeName]
		if u == nil {
			u = &usage{}
			requested[pod.Spec.NodeName] = u
		}
		cpu, memory := podRequests(pod)
		u.cpu += cpu
		u.memory += memory
		u.pods++
	}

	servers := make([]*models.ServerResponse, 0, len(nodes.Items))
	for i := range nodes.Items {
		node := &nodes.Items[i]
		u := requested[node.Name]
		if u == nil {
			u = &usage{}
		}
		servers = append(servers, &models.ServerResponse{
			Name:                       node.Name,
			Ready:                      nodeCondition(node, corev1.NodeReady),
			Unschedulable:              node.Spec.Unschedulable,
			Roles:                      nodeRoles(node),
			CreatedAt:                  node.CreationTimestamp.Time,
			OS:                         node.Status.NodeInfo.OSImage,
			Architecture:               node.Status.NodeInfo.Architecture,
			KubernetesVersion:          node.Status.NodeInfo.KubeletVersion,
			InternalIP:                 nodeAddress(node, corev1.NodeInternalIP),
			ExternalIP:                 nodeAddress(node, corev1.NodeExternalIP),
			CPUAllocatableMillicores:   node.Status.Allocatable.Cpu().MilliValue(),
			CPURequestedMillicores:     u.cpu,
			MemoryAllocatableMegabytes: node.Status.Allocatable.Memory().Value() / (1024 * 1024),
			MemoryRequestedMegabytes:   u.memory,
			PodCount:                   u.pods,
			PodCapacity:                node.Status.Allocatable.Pods().Value(),
			MemoryPressure:             nodeCondition(node, corev1.NodeMemoryPressure),
			DiskPressure:               nodeCondition(node, corev1.NodeDiskPressure),
			PIDPressure:                nodeCondition(node, corev1.NodePIDPressure),
		})
	}
	sort.Slice(servers, func(i, j int) bool { return servers[i].Name < servers[j].Name })
	return servers, nil
}

func isTerminated(pod *corev1.Pod) bool {
	return pod.Status.Phase == corev1.PodSucceeded || pod.Status.Phase == corev1.PodFailed
}

// podRequests follows the scheduler: the larger of the container sum and the biggest init container
func podRequests(pod *corev1.Pod) (cpuMillicores, memoryMegabytes int64) {
	for _, c := range pod.Spec.Containers {
		cpuMillicores += c.Resources.Requests.Cpu().MilliValue()
		memoryMegabytes += c.Resources.Requests.Memory().Value() / (1024 * 1024)
	}
	for _, c := range pod.Spec.InitContainers {
		cpuMillicores = max(cpuMillicores, c.Resources.Requests.Cpu().MilliValue())
		memoryMegabytes = max(memoryMegabytes, c.Resources.Requests.Memory().Value()/(1024*1024))
	}
	return cpuMillicores, memoryMegabytes
}

func nodeCondition(node *corev1.Node, conditionType corev1.NodeConditionType) bool {
	for _, c := range node.Status.Conditions {
		if c.Type == conditionType {
			return c.Status == corev1.ConditionTrue
		}
	}
	return false
}

func nodeAddress(node *corev1.Node, addressType corev1.NodeAddressType) string {
	for _, a := range node.Status.Addresses {
		if a.Type == addressType {
			return a.Address
		}
	}
	return ""
}

func nodeRoles(node *corev1.Node) []string {
	seen := map[string]bool{}
	roles := []string{}
	for label := range node.Labels {
		if !strings.HasPrefix(label, nodeRoleLabelPrefix) {
			continue
		}
		role := strings.TrimPrefix(label, nodeRoleLabelPrefix)
		if role == "master" {
			role = "control-plane"
		}
		if seen[role] {
			continue
		}
		seen[role] = true
		roles = append(roles, role)
	}
	if len(roles) == 0 {
		return []string{"worker"}
	}
	sort.Strings(roles)
	return roles
}
