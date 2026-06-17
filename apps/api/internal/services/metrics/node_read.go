package metric_service

import (
	"context"
	"fmt"
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

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Build options
	nodeMetricsFilters := prometheus.NodeMetricsFilter{}
	if input.NodeName != "" {
		nodeMetricsFilters.NodeName = []string{input.NodeName}
	}

	// Get start
	var start time.Time
	if input.Start.IsZero() {
		// Default to 24 hours ago
		start = time.Now().Add(-1 * 24 * time.Hour)
	} else {
		start = input.Start
	}

	// Get end
	var end time.Time
	if input.End.IsZero() {
		// Default to now
		end = time.Now()
	} else {
		end = input.End
	}

	// Calculate step size
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

	// Get metrics
	var filter *prometheus.NodeMetricsFilter
	if input.NodeName != "" || input.Zone != "" || input.Region != "" || input.ClusterName != "" {
		filter = &nodeMetricsFilters
	} else {
		filter = nil // Get all nodes if no specific filters
	}

	rawMetrics, err := self.promClient.GetNodeMetrics(ctx, start, end, step, filter)
	if err != nil {
		return nil, fmt.Errorf("error getting node metrics: %w", err)
	}

	// Convert to our format
	return models.TransformNodeMetricsEntity(rawMetrics, step), nil
}
