package prometheus

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

// Get metrics for specific nodes, keyed by the scrape target instance (<internal IP>:<port>)
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

	selector := buildNodeInstanceSelector(filter)
	cpuSelector := joinSelectors(`mode!="idle"`, selector)

	// Use fixed time windows that don't depend on step size
	cpuWindow := "5m"
	networkWindow := calculateNetworkWindow(step)
	diskWindow := calculateNetworkWindow(step) // Use same logic for disk I/O

	cpuQuery := fmt.Sprintf(`sum by (instance) (
		rate(node_cpu_seconds_total{%s}[%s])
	)`, cpuSelector, cpuWindow)

	ramQuery := fmt.Sprintf(`sum by (instance) (
		node_memory_MemTotal_bytes{%s} - node_memory_MemAvailable_bytes{%s}
	)`, selector, selector)

	networkQuery := fmt.Sprintf(`sum by (instance) (
		rate(node_network_receive_bytes_total{%s}[%s]) +
		rate(node_network_transmit_bytes_total{%s}[%s])
	)`, selector, networkWindow, selector, networkWindow)

	diskQuery := fmt.Sprintf(`sum by (instance) (
		rate(node_disk_read_bytes_total{%s}[%s]) +
		rate(node_disk_written_bytes_total{%s}[%s])
	)`, selector, diskWindow, selector, diskWindow)

	fsQuery := fmt.Sprintf(`sum by (instance) (
		node_filesystem_size_bytes{%s} - node_filesystem_free_bytes{%s}
	)`, selector, selector)

	loadQuery := fmt.Sprintf(`sum by (instance) (
		node_load1{%s}
	)`, selector)

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
	matrix, ok := result.(model.Matrix)
	if !ok {
		return
	}

	for _, series := range matrix {
		instance := string(series.Metric[model.LabelName("instance")])
		if instance == "" {
			continue
		}
		if _, exists := groupedMetrics[instance]; !exists {
			groupedMetrics[instance] = &NodeMetrics{}
		}
		assignFunc(groupedMetrics[instance], series.Values)
	}
}

// buildNodeInstanceSelector limits the queries to the given servers' scrape targets, matching
// any port so a node-exporter listening somewhere other than 9100 is still picked up
func buildNodeInstanceSelector(filter *NodeMetricsFilter) string {
	if filter == nil || len(filter.InstanceIPs) == 0 {
		return ""
	}

	patterns := make([]string, 0, len(filter.InstanceIPs))
	for _, ip := range filter.InstanceIPs {
		target := ip
		if strings.Contains(ip, ":") {
			target = "[" + ip + "]" // scrape targets bracket IPv6 addresses
		}
		// Each backslash is doubled because the matcher is a PromQL string literal
		escaped := strings.ReplaceAll(regexp.QuoteMeta(target), `\`, `\\`)
		patterns = append(patterns, escaped+`:\\d+`)
	}
	return fmt.Sprintf(`instance=~"%s"`, strings.Join(patterns, "|"))
}

func joinSelectors(selectors ...string) string {
	parts := make([]string, 0, len(selectors))
	for _, selector := range selectors {
		if selector == "" {
			continue
		}
		parts = append(parts, selector)
	}
	return strings.Join(parts, ", ")
}
