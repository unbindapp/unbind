package models

import (
	"sort"
	"time"

	"github.com/prometheus/common/model"
	"github.com/unbindapp/unbind-api/internal/infrastructure/prometheus"
)

// NodeMetricsQueryInput defines the query parameters for node prometheus metrics
type NodeMetricsQueryInput struct {
	NodeName    string    `query:"node_name" required:"false"`
	Zone        string    `query:"zone" required:"false"`
	Region      string    `query:"region" required:"false"`
	ClusterName string    `query:"cluster_name" required:"false"`
	Start       time.Time `query:"start" required:"false" doc:"Start time for the query, defaults to 24 hours ago"`
	End         time.Time `query:"end" required:"false" doc:"End time for the query, defaults to now"`
}

// NodeMetricsMapEntry contains arrays of metric details for each node resource type
type NodeMetricsMapEntry struct {
	CPU        []MetricDetail `json:"cpu" nullable:"false"`
	RAM        []MetricDetail `json:"ram" nullable:"false"`
	Disk       []MetricDetail `json:"disk" nullable:"false"`
	Network    []MetricDetail `json:"network" nullable:"false"`
	FileSystem []MetricDetail `json:"filesystem" nullable:"false"`
	Load       []MetricDetail `json:"load" nullable:"false"`
}

// NodeMetricsResult is the top-level structure containing the sampling interval and metrics
type NodeMetricsResult struct {
	Step    time.Duration       `json:"step"`
	Metrics NodeMetricsMapEntry `json:"metrics" nullable:"false"`
}

func TransformNodeMetricsEntity(metrics map[string]*prometheus.NodeMetrics, step time.Duration) *NodeMetricsResult {
	allTimestamps := collectAllNodeTimestamps(metrics)

	result := &NodeMetricsResult{
		Step: step,
		Metrics: NodeMetricsMapEntry{
			CPU:        aggregateNodeMetricsByTime(metrics, NodeMetricTypeCPU, allTimestamps),
			RAM:        aggregateNodeMetricsByTime(metrics, NodeMetricTypeRAM, allTimestamps),
			Disk:       aggregateNodeMetricsByTime(metrics, NodeMetricTypeDisk, allTimestamps),
			Network:    aggregateNodeMetricsByTime(metrics, NodeMetricTypeNetwork, allTimestamps),
			FileSystem: aggregateNodeMetricsByTime(metrics, NodeMetricTypeFileSystem, allTimestamps),
			Load:       aggregateNodeMetricsByTime(metrics, NodeMetricTypeLoad, allTimestamps),
		},
	}

	return result
}

// collectAllNodeTimestamps gathers all unique timestamps across all node metric types
func collectAllNodeTimestamps(metrics map[string]*prometheus.NodeMetrics) []time.Time {
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
		for _, sample := range metric.FileSystem {
			timestampMap[sample.Timestamp.Time()] = struct{}{}
		}
		for _, sample := range metric.Load {
			timestampMap[sample.Timestamp.Time()] = struct{}{}
		}
	}

	timestamps := make([]time.Time, len(timestampMap))
	i := 0
	for ts := range timestampMap {
		timestamps[i] = ts
		i++
	}

	sort.Slice(timestamps, func(i, j int) bool {
		return timestamps[i].Before(timestamps[j])
	})

	return timestamps
}

type NodeMetricType int

const (
	NodeMetricTypeCPU NodeMetricType = iota
	NodeMetricTypeRAM
	NodeMetricTypeDisk
	NodeMetricTypeNetwork
	NodeMetricTypeFileSystem
	NodeMetricTypeLoad
)

func aggregateNodeMetricsByTime(metrics map[string]*prometheus.NodeMetrics, metricType NodeMetricType, allTimestamps []time.Time) []MetricDetail {
	result := make([]MetricDetail, len(allTimestamps))

	nodeIDs := make([]string, 0, len(metrics))
	for id := range metrics {
		nodeIDs = append(nodeIDs, id)
	}

	for i, ts := range allTimestamps {
		result[i] = MetricDetail{
			Timestamp: ts,
			Value:     0,
			Breakdown: make(map[string]*float64),
		}

		for _, id := range nodeIDs {
			result[i].Breakdown[id] = nil
		}
	}

	timestampIndexMap := make(map[time.Time]int)
	for i, ts := range allTimestamps {
		timestampIndexMap[ts] = i
	}

	for id, samples := range metrics {
		var samplePair []model.SamplePair
		switch metricType {
		case NodeMetricTypeCPU:
			samplePair = samples.CPU
		case NodeMetricTypeRAM:
			samplePair = samples.RAM
		case NodeMetricTypeDisk:
			samplePair = samples.Disk
		case NodeMetricTypeNetwork:
			samplePair = samples.Network
		case NodeMetricTypeFileSystem:
			samplePair = samples.FileSystem
		case NodeMetricTypeLoad:
			samplePair = samples.Load
		}

		for _, sample := range samplePair {
			ts := sample.Timestamp.Time()
			if idx, ok := timestampIndexMap[ts]; ok {
				value := float64(sample.Value)
				result[idx].Breakdown[id] = new(value)

				result[idx].Value += value
			}
		}
	}

	return result
}
