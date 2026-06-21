package models

import "time"

// RegistryCacheCleanupRun summarizes the most recent cleanup job execution.
type RegistryCacheCleanupRun struct {
	StartedAt  *time.Time `json:"started_at" nullable:"true"`
	FinishedAt *time.Time `json:"finished_at" nullable:"true"`
	Status     string     `json:"status" doc:"running, succeeded, or failed"`
}

// RegistryCacheConfig describes the configurable state of the self-hosted
// registry cache (build cache + images share one volume).
type RegistryCacheConfig struct {
	Managed            bool    `json:"managed" doc:"False when an external registry is used; cache config does not apply"`
	CleanupThresholdGB float64 `json:"cleanup_threshold_gb" doc:"Cache size at which cleanup begins pruning"`
	CleanupSchedule    string  `json:"cleanup_schedule" doc:"Cron schedule for the cleanup job"`
	PVCCapacityGB      float64 `json:"pvc_capacity_gb" doc:"Provisioned size of the registry volume"`
	StorageClass       string  `json:"storage_class" doc:"Storage class backing the registry volume"`
	CanExpand          bool    `json:"can_expand" doc:"Whether the storage class supports growing the volume"`
	MinimumStorageGB   float64 `json:"minimum_storage_gb"`
	MaximumStorageGB   float64 `json:"maximum_storage_gb"`
	StorageStepGB      float64 `json:"storage_step_gb"`
}

// RegistryCacheStats describes current registry usage.
type RegistryCacheStats struct {
	Managed         bool                     `json:"managed"`
	UsedBytes       int64                    `json:"used_bytes"`
	PVCCapacityGB   float64                  `json:"pvc_capacity_gb"`
	ThresholdGB     float64                  `json:"cleanup_threshold_gb"`
	RepositoryCount int                      `json:"repository_count"`
	TagCount        int                      `json:"tag_count"`
	LastCleanup     *RegistryCacheCleanupRun `json:"last_cleanup" nullable:"true" doc:"Most recent cleanup run, null if none"`
}

// UpdateRegistryCacheInput configures the registry cache. Nil fields are unchanged.
type UpdateRegistryCacheInput struct {
	CleanupThresholdGB *float64 `json:"cleanup_threshold_gb,omitempty" required:"false" minimum:"0.1"`
	CleanupSchedule    *string  `json:"cleanup_schedule,omitempty" required:"false"`
	PVCCapacityGB      *float64 `json:"pvc_capacity_gb,omitempty" required:"false" minimum:"0.1" doc:"New volume size; can only grow"`
}
