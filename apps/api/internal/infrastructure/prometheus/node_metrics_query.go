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

const (
	// Bridges, veth pairs and the loopback carry the same packets as the physical interface they
	// sit behind, so counting them would report a multiple of the server's real traffic
	virtualNetworkDevices = `lo|veth.*|cni.*|flannel.*|docker.*|br-.*|cali.*|lxc.*|tunl.*|vxlan.*|dummy.*|kube-ipvs.*|nodelocaldns.*|cilium.*|tailscale.*|wg.*|tap.*|virbr.*`

	// Partitions and device-mapper devices repeat the I/O of the disk underneath them
	// Each backslash is doubled because the matcher is a PromQL string literal
	wholeDiskDevices = `nvme\\d+n\\d+|sd[a-z]+|vd[a-z]+|xvd[a-z]+|hd[a-z]+|mmcblk\\d+|md\\d+|rbd\\d+|dasd[a-z]+`

	// In-memory and pseudo filesystems are not disk space
	virtualFilesystemTypes = `tmpfs|ramfs|devtmpfs|overlay|squashfs|iso9660|nsfs|autofs|fuse.*|cgroup.*|debugfs|tracefs|configfs|mqueue|bpf|proc|procfs|sysfs|devpts|hugetlbfs|pstore|securityfs`
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

	// Use fixed time windows that don't depend on step size
	cpuWindow := "5m"
	networkWindow := calculateNetworkWindow(step)
	diskWindow := calculateNetworkWindow(step) // Use same logic for disk I/O

	// idle, iowait and steal are not time the CPU spent running anything, so they are not usage
	cpuQuery := fmt.Sprintf(`sum by (instance) (
		rate(node_cpu_seconds_total{%s}[%s])
	)`, joinSelectors(`mode!~"idle|iowait|steal"`, selector), cpuWindow)

	// Working set: everything in use except the page cache the kernel can drop right away. Same
	// definition the kubelet uses for eviction and the same one container metrics report, so a
	// team's usage is always a subset of its server's
	ramQuery := fmt.Sprintf(`sum by (instance) (
		node_memory_MemTotal_bytes{%s}
		- node_memory_MemFree_bytes{%s}
		- node_memory_Inactive_file_bytes{%s}
	)`, selector, selector, selector)

	networkSelector := joinSelectors(fmt.Sprintf(`device!~"%s"`, virtualNetworkDevices), selector)
	networkQuery := fmt.Sprintf(`sum by (instance) (
		rate(node_network_receive_bytes_total{%s}[%s]) +
		rate(node_network_transmit_bytes_total{%s}[%s])
	)`, networkSelector, networkWindow, networkSelector, networkWindow)

	diskSelector := joinSelectors(fmt.Sprintf(`device=~"%s"`, wholeDiskDevices), selector)
	diskQuery := fmt.Sprintf(`sum by (instance) (
		rate(node_disk_read_bytes_total{%s}[%s]) +
		rate(node_disk_written_bytes_total{%s}[%s])
	)`, diskSelector, diskWindow, diskSelector, diskWindow)

	// One filesystem can be mounted in several places, so collapse to a single value per device.
	// Volume mounts are left out, they are the same bytes the disk holding them already reports
	fsSelector := joinSelectors(
		fmt.Sprintf(`fstype!~"%s"`, virtualFilesystemTypes),
		`mountpoint!~"/var/lib/kubelet/.*"`,
		selector,
	)
	fsQuery := fmt.Sprintf(`sum by (instance) (
		max by (instance, device) (
			node_filesystem_size_bytes{%s} - node_filesystem_free_bytes{%s}
		)
	)`, fsSelector, fsSelector)

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
