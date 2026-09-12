package metric_service

import (
	"context"
	"fmt"
	"net"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/infrastructure/prometheus"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

// New method for getting node metrics
func (self *MetricsService) GetNodeMetrics(ctx context.Context, requesterUserID uuid.UUID, input *models.NodeMetricsQueryInput) (*models.NodeMetricsResult, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeSystem,
		},
	}

	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	var names []string
	if input.NodeName != "" {
		names = []string{input.NodeName}
	}

	// node-exporter labels its series with the scrape target, so servers are selected by IP
	ipsByName, err := self.k8s.NodeInternalIPs(ctx, names...)
	if err != nil {
		return nil, err
	}

	filter := &prometheus.NodeMetricsFilter{InstanceIPs: make([]string, 0, len(ipsByName))}
	namesByIP := make(map[string]string, len(ipsByName))
	for name, ip := range ipsByName {
		filter.InstanceIPs = append(filter.InstanceIPs, ip)
		namesByIP[ip] = name
	}

	var start time.Time
	if input.Start.IsZero() {
		// Default to 24 hours ago
		start = time.Now().Add(-1 * 24 * time.Hour)
	} else {
		start = input.Start
	}

	var end time.Time
	if input.End.IsZero() {
		// Default to now
		end = time.Now()
	} else {
		end = input.End
	}

	duration := end.Sub(start)
	step := chooseStep(duration, 30, []time.Duration{
		1 * time.Minute,
		5 * time.Minute,
		15 * time.Minute,
		30 * time.Minute,
		1 * time.Hour,
		2 * time.Hour,
		4 * time.Hour,
		8 * time.Hour,
		12 * time.Hour,
		1 * 24 * time.Hour,
	})

	rawMetrics, err := self.promClient.GetNodeMetrics(ctx, start, end, step, filter)
	if err != nil {
		return nil, fmt.Errorf("error getting node metrics: %w", err)
	}

	return models.TransformNodeMetricsEntity(metricsByServerName(rawMetrics, namesByIP), step), nil
}

// metricsByServerName re-keys the scrape target instances (<internal IP>:<port>) to server names
func metricsByServerName(
	metrics map[string]*prometheus.NodeMetrics,
	namesByIP map[string]string,
) map[string]*prometheus.NodeMetrics {
	result := make(map[string]*prometheus.NodeMetrics, len(metrics))
	for instance, nodeMetrics := range metrics {
		ip, _, err := net.SplitHostPort(instance)
		if err != nil {
			ip = instance
		}
		name, ok := namesByIP[ip]
		if !ok {
			continue
		}
		result[name] = nodeMetrics
	}
	return result
}
