package prometheus

import (
	"context"
	"fmt"
	"strings"
	"time"

	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

// Get metrics for specific nodes
func (self *PrometheusClient) GetNodeMetrics(
	ctx context.Context,
	start time.Time,
	end time.Time,
	step time.Duration,
	filter *NodeMetricsFilter,
) (map[string]*NodeMetrics, error) {
	// Align start and end times to step boundaries for consistent sampling
	alignedStart := alignTimeToStep(start, step)
	alignedEnd := alignTimeToStep(end, step)

	r := v1.Range{
		Start: alignedStart,
		End:   alignedEnd,
		Step:  step,
	}

	// Build the label selector for node metrics
	nodeSelector := buildNodeLabelSelector(filter)

	// Use fixed time windows that don't depend on step size
	cpuWindow := "5m"
	networkWindow := calculateNetworkWindow(step)
	diskWindow := calculateNetworkWindow(step) // Use same logic for disk I/O

	// Queries for node-level metrics with fixed time windows
	cpuQuery := fmt.Sprintf(`sum by (nodename) (
		rate(node_cpu_seconds_total{mode!="idle"}[%s])%s * on(instance) group_left(nodename) node_uname_info
	)`, cpuWindow, nodeSelector)

	ramQuery := fmt.Sprintf(`sum by (nodename) (
		(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes)%s * on(instance) group_left(nodename) node_uname_info
	)`, nodeSelector)

	networkQuery := fmt.Sprintf(`sum by (nodename) (
		(rate(node_network_receive_bytes_total[%s]) + 
		 rate(node_network_transmit_bytes_total[%s])%s) * on(instance) group_left(nodename) node_uname_info
	)`, networkWindow, networkWindow, nodeSelector)

	diskQuery := fmt.Sprintf(`sum by (nodename) (
		(rate(node_disk_read_bytes_total[%s]) + 
		 rate(node_disk_written_bytes_total[%s])%s) * on(instance) group_left(nodename) node_uname_info
	)`, diskWindow, diskWindow, nodeSelector)

	fsQuery := fmt.Sprintf(`sum by (nodename) (
		(node_filesystem_size_bytes%s - node_filesystem_free_bytes%s) * on(instance) group_left(nodename) node_uname_info
	)`, nodeSelector, nodeSelector)

	// Load average
	loadQuery := fmt.Sprintf(`sum by (nodename) (
		node_load1%s * on(instance) group_left(nodename) node_uname_info
	)`, nodeSelector)

	// Execute queries
	cpuResult, _, err := self.api.QueryRange(ctx, cpuQuery, r)
	if err != nil {
		return nil, fmt.Errorf("error querying node CPU metrics: %w", err)
	}

	ramResult, _, err := self.api.QueryRange(ctx, ramQuery, r)
	if err != nil {
		return nil, fmt.Errorf("error querying node RAM metrics: %w", err)
	}

	networkResult, _, err := self.api.QueryRange(ctx, networkQuery, r)
	if err != nil {
		return nil, fmt.Errorf("error querying node network metrics: %w", err)
	}

	diskResult, _, err := self.api.QueryRange(ctx, diskQuery, r)
	if err != nil {
		return nil, fmt.Errorf("error querying node disk metrics: %w", err)
	}

	fsResult, _, err := self.api.QueryRange(ctx, fsQuery, r)
	if err != nil {
		return nil, fmt.Errorf("error querying node filesystem metrics: %w", err)
	}

	loadResult, _, err := self.api.QueryRange(ctx, loadQuery, r)
	if err != nil {
		return nil, fmt.Errorf("error querying node load metrics: %w", err)
	}

	// Process results
	metricsResult := make(map[string]*NodeMetrics)

	extractNodeMetrics(cpuResult, metricsResult, func(metrics *NodeMetrics, samples []model.SamplePair) {
		metrics.CPU = samples
	})

	extractNodeMetrics(ramResult, metricsResult, func(metrics *NodeMetrics, samples []model.SamplePair) {
		metrics.RAM = samples
	})

	extractNodeMetrics(networkResult, metricsResult, func(metrics *NodeMetrics, samples []model.SamplePair) {
		metrics.Network = samples
	})

	extractNodeMetrics(diskResult, metricsResult, func(metrics *NodeMetrics, samples []model.SamplePair) {
		metrics.Disk = samples
	})

	extractNodeMetrics(fsResult, metricsResult, func(metrics *NodeMetrics, samples []model.SamplePair) {
		metrics.FileSystem = samples
	})

	extractNodeMetrics(loadResult, metricsResult, func(metrics *NodeMetrics, samples []model.SamplePair) {
		metrics.Load = samples
	})

	return metricsResult, nil
}

func extractNodeMetrics(
	result model.Value,
	groupedMetrics map[string]*NodeMetrics,
	assignFunc func(*NodeMetrics, []model.SamplePair),
) {
	if matrix, ok := result.(model.Matrix); ok {
		for _, series := range matrix {
			// Get node identifier from the metric labels
			nodeID := string(series.Metric[model.LabelName("nodename")])
			if nodeID == "" {
				nodeID = "unknown" // Default for metrics without the specified label
			}

			// Create node entry if it doesn't exist
			if _, exists := groupedMetrics[nodeID]; !exists {
				groupedMetrics[nodeID] = &NodeMetrics{}
			}

			// Assign metrics using the provided function
			assignFunc(groupedMetrics[nodeID], series.Values)
		}
	}
}

// buildNodeLabelSelector constructs a Prometheus label selector string for node metrics filtering
func buildNodeLabelSelector(filter *NodeMetricsFilter) string {
	if filter == nil {
		return ""
	}

	var selector string

	// Add node name filter
	if len(filter.NodeName) > 0 {
		selector += buildLabelValueFilter("nodename", filter.NodeName)
	}

	return selector
}

// buildLabelValueFilter creates a label filter expression for Prometheus
func buildLabelValueFilter(label string, values []string) string {
	if len(values) == 0 {
		return ""
	}

	if len(values) == 1 {
		return fmt.Sprintf(`, %s="%s"`, label, values[0])
	}

	// Create regex pattern with all values joined by |
	regexPattern := strings.Join(values, "|")
	return fmt.Sprintf(`, %s=~"%s"`, label, regexPattern)
}
