package models

import "time"

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

	MemoryPressure bool `json:"memory_pressure"`
	DiskPressure   bool `json:"disk_pressure"`
	PIDPressure    bool `json:"pid_pressure"`
}
