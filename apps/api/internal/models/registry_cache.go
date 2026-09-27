package models

import "time"

type RegistryCleanupOutcome string

const (
	RegistryCleanupUnderThreshold RegistryCleanupOutcome = "under_threshold"
	RegistryCleanupCleaned        RegistryCleanupOutcome = "cleaned"
	RegistryCleanupOverThreshold  RegistryCleanupOutcome = "over_threshold"
	RegistryCleanupSkipped        RegistryCleanupOutcome = "skipped"
)

// RegistryCleanupResult is what a cleanup run reports when it exits.
type RegistryCleanupResult struct {
	Outcome       RegistryCleanupOutcome `json:"outcome,omitempty" required:"false" enum:"under_threshold,cleaned,over_threshold,skipped" doc:"under_threshold: nothing to do. cleaned: usage is under the threshold. over_threshold: usage is still over the threshold because everything left is protected. skipped: builds or another cleanup kept running"`
	FreedBytes    int64                  `json:"freed_bytes"`
	DeletedImages int                    `json:"deleted_images"`
	Error         string                 `json:"error,omitempty" required:"false"`
}

// RegistryCacheCleanupRun summarizes the most recent cleanup job execution.
type RegistryCacheCleanupRun struct {
	StartedAt  *time.Time             `json:"started_at" nullable:"true"`
	FinishedAt *time.Time             `json:"finished_at" nullable:"true"`
	Status     string                 `json:"status" enum:"running,succeeded,failed"`
	Manual     bool                   `json:"manual" doc:"Started by a user instead of the schedule"`
	Result     *RegistryCleanupResult `json:"result,omitempty" required:"false" doc:"Omitted while running or when the run did not report one"`
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
	UsedBytes       int64                    `json:"used_bytes" doc:"Disk used by the registry volume, the number cleanup compares to the threshold"`
	PVCCapacityGB   float64                  `json:"pvc_capacity_gb"`
	ThresholdGB     float64                  `json:"cleanup_threshold_gb"`
	RepositoryCount int                      `json:"repository_count"`
	ImageCount      int                      `json:"image_count" doc:"Image tags, build caches excluded"`
	LastCleanup     *RegistryCacheCleanupRun `json:"last_cleanup,omitempty" doc:"Most recent cleanup run, omitted if none"`
}

// UpdateRegistryCacheInput configures the registry cache. Nil fields are unchanged.
type UpdateRegistryCacheInput struct {
	CleanupThresholdGB *float64 `json:"cleanup_threshold_gb,omitempty" required:"false" minimum:"0.1"`
	CleanupSchedule    *string  `json:"cleanup_schedule,omitempty" required:"false"`
	PVCCapacityGB      *float64 `json:"pvc_capacity_gb,omitempty" required:"false" minimum:"0.1" doc:"New volume size; can only grow"`
}
