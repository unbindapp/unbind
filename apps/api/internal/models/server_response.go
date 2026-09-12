package models

import "time"

// ServerConditionType is what the condition is about, in Unbind's terms rather than the kubelet's
type ServerConditionType string

const (
	ServerConditionTypeMemory    ServerConditionType = "memory"
	ServerConditionTypeDisk      ServerConditionType = "disk"
	ServerConditionTypeProcesses ServerConditionType = "processes"
	ServerConditionTypeNetwork   ServerConditionType = "network"
)

type ServerConditionStatus string

const (
	ServerConditionStatusHealthy   ServerConditionStatus = "healthy"
	ServerConditionStatusUnhealthy ServerConditionStatus = "unhealthy"
	ServerConditionStatusUnknown   ServerConditionStatus = "unknown"
)

type ServerConditionResponse struct {
	Type   ServerConditionType   `json:"type" enum:"memory,disk,processes,network"`
	Status ServerConditionStatus `json:"status" enum:"healthy,unhealthy,unknown"`
}

type ServerResponse struct {
	Name              string    `json:"name"`
	Ready             bool      `json:"ready"`
	Unschedulable     bool      `json:"unschedulable"`
	Roles             []string  `json:"roles" nullable:"false"`
	CreatedAt         time.Time `json:"created_at"`
	OS                string    `json:"os"`
	Architecture      string    `json:"architecture"`
	KubernetesVersion string    `json:"kubernetes_version"`
	InternalIP        string    `json:"internal_ip"`
	ExternalIP        string    `json:"external_ip"`

	CPUAllocatableMillicores   int64 `json:"cpu_allocatable_millicores"`
	CPURequestedMillicores     int64 `json:"cpu_requested_millicores"`
	MemoryAllocatableMegabytes int64 `json:"memory_allocatable_megabytes"`
	MemoryRequestedMegabytes   int64 `json:"memory_requested_megabytes"`
	PodCount                   int64 `json:"pod_count"`
	PodCapacity                int64 `json:"pod_capacity"`

	Conditions []ServerConditionResponse `json:"conditions" nullable:"false"`
}

type ServerTaintResponse struct {
	Key    string `json:"key"`
	Value  string `json:"value"`
	Effect string `json:"effect"`
}

type ServerDetailResponse struct {
	ServerResponse
	KernelVersion    string `json:"kernel_version"`
	ContainerRuntime string `json:"container_runtime"`

	CPUCapacityMillicores   int64 `json:"cpu_capacity_millicores"`
	MemoryCapacityMegabytes int64 `json:"memory_capacity_megabytes"`

	Taints []ServerTaintResponse `json:"taints" nullable:"false"`
}
