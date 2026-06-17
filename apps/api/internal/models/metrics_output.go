package models

import (
	"sort"
	"time"

	"github.com/prometheus/common/model"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/infrastructure/prometheus"
)

// MetricDetail represents a single metric with aggregate value and breakdown by service
type MetricDetail struct {
	Timestamp time.Time `json:"timestamp"`
	// Aggregated value for the metric
	Value float64 `json:"value" doc:"Aggregated value for the timestamp"`
	// Map of IDs to their respective values
	Breakdown map[string]*float64 `json:"breakdown" doc:"Map of IDs to their respective values"`
}

// MetricsMapEntry contains arrays of metric details for each resource type
type MetricsMapEntry struct {
	CPU     []MetricDetail `json:"cpu" nullable:"false"`
	RAM     []MetricDetail `json:"ram" nullable:"false"`
	Disk    []MetricDetail `json:"disk" nullable:"false"`
	Network []MetricDetail `json:"network" nullable:"false"`
}

// MetricsResult is the top-level structure containing the sampling interval and metrics
type MetricsResult struct {
	Step         time.Duration   `json:"step"`
	BrokenDownBy MetricsType     `json:"broken_down_by" doc:"The type of metric that is broken down, e.g. team, project"`
	Metrics      MetricsMapEntry `json:"metrics" nullable:"false"`
}

// VolumeMetricsResult is the structure for volume-specific metrics
type VolumeMetricsResult struct {
	Step    time.Duration  `json:"step"`
	PVCName string         `json:"pvc_name"`
	Stats   PVCStats       `json:"stats"`
	History []MetricDetail `json:"history" nullable:"false"`
}

// PVCStats holds current volume statistics
type PVCStats struct {
	UsedGB     *float64 `json:"used_gb,omitempty"`
	CapacityGB float64  `json:"capacity_gb,omitempty"`
}

func TransformMetricsEntity(metrics map[string]*prometheus.ResourceMetrics, step time.Duration, sumBy prometheus.MetricsFilterSumBy) *MetricsResult {
	brokenDownBy := MetricsTypeService
	switch sumBy {
	case prometheus.MetricsFilterSumByProject:
		brokenDownBy = MetricsTypeProject
	case prometheus.MetricsFilterSumByEnvironment:
		brokenDownBy = MetricsTypeEnvironment
	case prometheus.MetricsFilterSumByService:
		brokenDownBy = MetricsTypeService
	}

	// Collect all unique timestamps across all metrics and types
	allTimestamps := collectAllTimestamps(metrics)

	result := &MetricsResult{
		Step:         step,
		BrokenDownBy: brokenDownBy,
		Metrics: MetricsMapEntry{
			CPU:     aggregateMetricsByTime(metrics, MetricTypeCPU, allTimestamps),
			RAM:     aggregateMetricsByTime(metrics, MetricTypeRAM, allTimestamps),
			Disk:    aggregateMetricsByTime(metrics, MetricTypeDisk, allTimestamps),
			Network: aggregateMetricsByTime(metrics, MetricTypeNetwork, allTimestamps),
		},
	}

	return result
}

// collectAllTimestamps gathers all unique timestamps across all metric types
func collectAllTimestamps(metrics map[string]*prometheus.ResourceMetrics) []time.Time {
	// Use a map to collect unique timestamps
	timestampMap := make(map[time.Time]struct{})

	for _, metric := range metrics {
		for _, sample := range metric.CPU {
			timestampMap[sample.Timestamp.Time()] = struct{}{}
		}
		for _, sample := range metric.RAM {
			timestampMap[sample.Timestamp.Time()] = struct{}{}
		}
		for _, sample := range metric.Disk {
			timestampMap[sample.Timestamp.Time()] = struct{}{}
		}
		for _, sample := range metric.Network {
			timestampMap[sample.Timestamp.Time()] = struct{}{}
		}
	}

	// Convert map keys to a slice
	timestamps := make([]time.Time, len(timestampMap))
	i := 0
	for ts := range timestampMap {
		timestamps[i] = ts
		i++
	}

	// Sort timestamps chronologically
	sort.Slice(timestamps, func(i, j int) bool {
		return timestamps[i].Before(timestamps[j])
	})

	return timestamps
}

type MetricType int

const (
	MetricTypeCPU MetricType = iota
	MetricTypeRAM
	MetricTypeDisk
	MetricTypeNetwork
)

func aggregateMetricsByTime(metrics map[string]*prometheus.ResourceMetrics, metricType MetricType, allTimestamps []time.Time) []MetricDetail {
	// Initialize result with all timestamps
	result := make([]MetricDetail, len(allTimestamps))
	for i, ts := range allTimestamps {
		result[i] = MetricDetail{
			Timestamp: ts,
			Value:     0,
			Breakdown: make(map[string]*float64),
		}

		// Initialize breakdown map with nil values for all keys
		for id := range metrics {
			result[i].Breakdown[id] = nil
		}
	}

	// Create a map for quick timestamp lookup
	timestampIndexMap := make(map[time.Time]int)
	for i, ts := range allTimestamps {
		timestampIndexMap[ts] = i
	}

	// Fill in actual values
	for id, samples := range metrics {
		var samplePair []model.SamplePair
		switch metricType {
		case MetricTypeCPU:
			samplePair = samples.CPU
		case MetricTypeRAM:
			samplePair = samples.RAM
		case MetricTypeDisk:
			samplePair = samples.Disk
		case MetricTypeNetwork:
			samplePair = samples.Network
		}

		for _, sample := range samplePair {
			ts := sample.Timestamp.Time()
			idx := timestampIndexMap[ts]

			value := float64(sample.Value)
			result[idx].Breakdown[id] = utils.ToPtr(value)
			result[idx].Value += value
		}
	}

	return result
}

// Transform VolumeStatsWithHistory into VolumeMetricsResult
func TransformVolumeStatsEntity(volumeStats *prometheus.VolumeStatsWithHistory, step time.Duration) *VolumeMetricsResult {
	if volumeStats == nil {
		return &VolumeMetricsResult{
			Step:    step,
			PVCName: "",
			Stats:   PVCStats{},
			History: []MetricDetail{},
		}
	}

	// Convert history to MetricDetail format
	history := make([]MetricDetail, len(volumeStats.History))
	for i, sample := range volumeStats.History {
		value := float64(sample.Value)
		history[i] = MetricDetail{
			Timestamp: sample.Timestamp.Time(),
			Value:     value,
			Breakdown: map[string]*float64{
				volumeStats.Stats.PVCName: utils.ToPtr(value),
			},
		}
	}

	return &VolumeMetricsResult{
		Step:    step,
		PVCName: volumeStats.Stats.PVCName,
		Stats: PVCStats{
			UsedGB:     volumeStats.Stats.UsedGB,
			CapacityGB: volumeStats.Stats.CapacityGB,
		},
		History: history,
	}
}
