package k8s

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const nodeRoleLabelPrefix = "node-role.kubernetes.io/"

type usage struct {
	cpu, memory, pods int64
}

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
		servers = append(servers, serverResponse(node, u))
	}
	sort.Slice(servers, func(i, j int) bool { return servers[i].Name < servers[j].Name })
	return servers, nil
}

// GetServer returns a single node with the conditions, taints and hardware details the list omits
func (self *KubeClient) GetServer(ctx context.Context, name string) (*models.ServerDetailResponse, error) {
	node, err := self.clientset.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, fmt.Sprintf("Server '%s' not found", name))
		}
		return nil, fmt.Errorf("failed to get node '%s': %w", name, err)
	}

	pods, err := self.clientset.CoreV1().Pods(metav1.NamespaceAll).List(ctx, metav1.ListOptions{
		FieldSelector: fmt.Sprintf("spec.nodeName=%s,status.phase!=Succeeded,status.phase!=Failed", name),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods of node '%s': %w", name, err)
	}

	u := &usage{}
	for i := range pods.Items {
		pod := &pods.Items[i]
		if pod.Spec.NodeName != name || isTerminated(pod) {
			continue
		}
		cpu, memory := podRequests(pod)
		u.cpu += cpu
		u.memory += memory
		u.pods++
	}

	taints := make([]models.ServerTaintResponse, 0, len(node.Spec.Taints))
	for _, t := range node.Spec.Taints {
		taints = append(taints, models.ServerTaintResponse{
			Key:    t.Key,
			Value:  t.Value,
			Effect: string(t.Effect),
		})
	}

	return &models.ServerDetailResponse{
		ServerResponse:          *serverResponse(node, u),
		KernelVersion:           node.Status.NodeInfo.KernelVersion,
		ContainerRuntime:        node.Status.NodeInfo.ContainerRuntimeVersion,
		CPUCapacityMillicores:   node.Status.Capacity.Cpu().MilliValue(),
		MemoryCapacityMegabytes: node.Status.Capacity.Memory().Value() / (1024 * 1024),
		Taints:                  taints,
	}, nil
}

// NodeInternalIPs maps server names to their internal IPs, which is how metrics scrape targets are labelled
func (self *KubeClient) NodeInternalIPs(ctx context.Context, names ...string) (map[string]string, error) {
	nodes, err := self.clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list nodes: %w", err)
	}

	wanted := make(map[string]bool, len(names))
	for _, name := range names {
		wanted[name] = true
	}

	ips := make(map[string]string, len(nodes.Items))
	for i := range nodes.Items {
		node := &nodes.Items[i]
		if len(wanted) > 0 && !wanted[node.Name] {
			continue
		}
		ip := nodeAddress(node, corev1.NodeInternalIP)
		if ip == "" {
			continue
		}
		ips[node.Name] = ip
	}

	for _, name := range names {
		if _, ok := ips[name]; !ok {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, fmt.Sprintf("Server '%s' not found", name))
		}
	}

	return ips, nil
}

func serverResponse(node *corev1.Node, u *usage) *models.ServerResponse {
	return &models.ServerResponse{
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
		Conditions:                 serverConditions(node),
	}
}

// The kubelet reports a condition per resource it can run short of, plus the cloud
// controller's network check. Their "pressure is true" phrasing is flipped here so
// every condition reads the same way: healthy or not.
var serverConditionTypes = []struct {
	nodeType      corev1.NodeConditionType
	conditionType models.ServerConditionType
}{
	{corev1.NodeMemoryPressure, models.ServerConditionTypeMemory},
	{corev1.NodeDiskPressure, models.ServerConditionTypeDisk},
	{corev1.NodePIDPressure, models.ServerConditionTypeProcesses},
	{corev1.NodeNetworkUnavailable, models.ServerConditionTypeNetwork},
}

func serverConditions(node *corev1.Node) []models.ServerConditionResponse {
	conditions := make([]models.ServerConditionResponse, 0, len(serverConditionTypes))
	for _, candidate := range serverConditionTypes {
		status, reported := nodeConditionStatus(node, candidate.nodeType)
		if !reported {
			continue
		}
		conditions = append(conditions, models.ServerConditionResponse{
			Type:   candidate.conditionType,
			Status: status,
		})
	}
	return conditions
}

func nodeConditionStatus(
	node *corev1.Node,
	conditionType corev1.NodeConditionType,
) (models.ServerConditionStatus, bool) {
	for _, c := range node.Status.Conditions {
		if c.Type != conditionType {
			continue
		}
		if c.Status == corev1.ConditionTrue {
			return models.ServerConditionStatusUnhealthy, true
		}
		if c.Status == corev1.ConditionFalse {
			return models.ServerConditionStatusHealthy, true
		}
		return models.ServerConditionStatusUnknown, true
	}
	return models.ServerConditionStatusUnknown, false
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
