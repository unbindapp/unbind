package prometheus

import (
	"context"
	"fmt"
	"strings"
	"time"

	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// PVCVolumeStats holds the used and capacity stats for a PVC.
type PVCVolumeStats struct {
	PVCName    string   `json:"pvc_name"`
	UsedGB     *float64 `json:"used_gb,omitempty"`
	CapacityGB float64  `json:"capacity_gb,omitempty"`
}

// VolumeStatsWithHistory combines current PVC stats with historical usage data.
type VolumeStatsWithHistory struct {
	Stats   *PVCVolumeStats    `json:"stats"`
	History []model.SamplePair `json:"history"`
}

// GetPVCsVolumeStats queries Prometheus for volume usage and gets all PVC info from Kubernetes.
// Returns stats for all requested PVCs from K8s, with UsedGB attached from Prometheus when available.
func (self *PrometheusClient) GetPVCsVolumeStats(ctx context.Context, pvcNames []string, namespace string, client kubernetes.Interface) ([]*PVCVolumeStats, error) {
	if len(pvcNames) == 0 {
		return []*PVCVolumeStats{}, nil
	}

	// Get all PVC info from Kubernetes first
	pvcCapacities, err := self.getPVCsFromK8s(ctx, namespace, pvcNames, client)
	if err != nil {
		return nil, fmt.Errorf("failed to get PVCs from Kubernetes: %w", err)
	}

	// Get usage stats from Prometheus
	usageMap, err := self.getPrometheusUsageStats(ctx, pvcNames)
	if err != nil {
		// Log the error but don't fail - we can still return PVC info without usage stats
		log.Errorf("Failed to get PVC usage stats from Prometheus: %v", err)
	}

	// Build final results - one entry per requested PVC name
	finalStats := []*PVCVolumeStats{}
	for _, name := range pvcNames {
		// Start with K8s data if available
		if capacity, found := pvcCapacities[name]; found && capacity != nil {
			stat := &PVCVolumeStats{
				PVCName:    name,
				CapacityGB: *capacity,
			}

			// Add Prometheus usage data if available
			if usageMap != nil {
				if usedGB, hasUsage := usageMap[name]; hasUsage {
					stat.UsedGB = usedGB
				}
			}

			finalStats = append(finalStats, stat)
		}
	}

	return finalStats, nil
}

// getPrometheusUsageStats queries Prometheus for volume usage stats
func (self *PrometheusClient) getPrometheusUsageStats(ctx context.Context, pvcNames []string) (map[string]*float64, error) {
	pvcRegex := strings.Join(pvcNames, "|")

	query := fmt.Sprintf(`
(
  label_replace(
    last_over_time(
      kubelet_volume_stats_used_bytes{
        persistentvolumeclaim=~"%s", job="kubelet"
      }[10m]
    ) / 1024 / 1024 / 1024,
    "kind", "used", "persistentvolumeclaim", ".*"
  )
)
`, pvcRegex)

	result, _, err := self.api.Query(ctx, query, time.Now())
	if err != nil {
		return nil, fmt.Errorf("prometheus query failed for PVC usage stats: %w", err)
	}

	vectorData, ok := result.(model.Vector)
	if !ok {
		return nil, fmt.Errorf("unexpected result type from Prometheus for PVC usage stats: expected model.Vector, got %T", result)
	}

	usageMap := make(map[string]*float64) // pvcName -> usedGB

	for _, sample := range vectorData {
		metric := sample.Metric
		pvcNameFromMetric := string(metric["persistentvolumeclaim"])
		value := float64(sample.Value)

		// Ensure this pvcName is one we requested
		isTargetPVC := false
		for _, requestedName := range pvcNames {
			if pvcNameFromMetric == requestedName {
				isTargetPVC = true
				break
			}
		}

		if !isTargetPVC {
			continue
		}

		usageMap[pvcNameFromMetric] = utils.ToPtr(value)
	}

	return usageMap, nil
}

// Helper function to get PVC capacities from Kubernetes API for multiple PVCs
func (self *PrometheusClient) getPVCsFromK8s(ctx context.Context, namespace string, pvcNames []string, client kubernetes.Interface) (map[string]*float64, error) {
	results := make(map[string]*float64)

	// Create a set of requested PVC names for efficient lookup
	requestedPVCs := make(map[string]bool)
	for _, name := range pvcNames {
		requestedPVCs[name] = true
		results[name] = nil // Initialize with nil
	}

	// Single API call to list all PVCs in the namespace
	pvcList, err := client.CoreV1().PersistentVolumeClaims(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return results, err
	}

	// Filter and process only the requested PVCs
	for _, pvc := range pvcList.Items {
		if !requestedPVCs[pvc.Name] {
			continue // Skip PVCs we didn't request
		}

		var capacity *float64

		// First try to get capacity from PVC status
		if pvc.Status.Capacity != nil {
			if capacityQuantity, ok := pvc.Status.Capacity[corev1.ResourceStorage]; ok {
				bytesValue := capacityQuantity.Value()
				gbValue := float64(bytesValue) / (1024 * 1024 * 1024)
				capacity = &gbValue
			}
		}

		// Fall back to requests if capacity is not set
		if capacity == nil {
			if storageRequest, ok := pvc.Spec.Resources.Requests[corev1.ResourceStorage]; ok {
				bytesValue := storageRequest.Value()
				gbValue := float64(bytesValue) / (1024 * 1024 * 1024)
				capacity = &gbValue
			}
		}

		results[pvc.Name] = capacity
	}

	return results, nil
}

// GetVolumeStatsWithHistory gets both current PVC stats and historical usage data for a specific volume.
// This is equivalent to the diskQuery but targeted at a specific volume by name.
func (self *PrometheusClient) GetVolumeStatsWithHistory(
	ctx context.Context,
	pvcName string,
	start time.Time,
	end time.Time,
	step time.Duration,
	namespace string,
	client kubernetes.Interface,
) (*VolumeStatsWithHistory, error) {
	// First try to get current stats using existing method (works for attached volumes)
	stats, err := self.GetPVCsVolumeStats(ctx, []string{pvcName}, namespace, client)
	if err != nil {
		return nil, fmt.Errorf("failed to get PVC stats: %w", err)
	}

	// Align start and end times to step boundaries for consistent sampling
	alignedStart := alignTimeToStep(start, step)
	alignedEnd := alignTimeToStep(end, step)

	// Get historical data using a query similar to diskQuery but for specific PVC
	r := v1.Range{
		Start: alignedStart,
		End:   alignedEnd,
		Step:  step,
	}

	// Historical usage query for the specific PVC - only works for attached volumes
	historyQuery := fmt.Sprintf(`
		max by (persistentvolumeclaim) (
			kubelet_volume_stats_used_bytes{persistentvolumeclaim="%s"}
		)
	`, pvcName)

	result, _, err := self.api.QueryRange(ctx, historyQuery, r)
	if err != nil {
		return nil, fmt.Errorf("failed to query volume history for PVC %s: %w", pvcName, err)
	}

	var history []model.SamplePair
	if matrix, ok := result.(model.Matrix); ok && len(matrix) > 0 {
		// Since we filter by specific PVC name, there should be at most one series
		history = matrix[0].Values
	}

	var pvcStats *PVCVolumeStats
	if len(stats) > 0 {
		pvcStats = stats[0]
	}

	return &VolumeStatsWithHistory{
		Stats:   pvcStats,
		History: history,
	}, nil
}
