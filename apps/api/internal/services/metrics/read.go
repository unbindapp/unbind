package metric_service

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/infrastructure/prometheus"
	"github.com/unbindapp/unbind-api/internal/models"
)

func (self *MetricsService) GetMetrics(ctx context.Context, requesterUserID uuid.UUID, input *models.MetricsQueryInput) (*models.MetricsResult, error) {
	team, project, environment, service, err := self.validatePermissionsAndParseInputs(ctx, requesterUserID, input)
	if err != nil {
		return nil, err
	}

	// Build options
	metricsFilters := prometheus.MetricsFilter{}
	sumBy := prometheus.MetricsFilterSumByService

	// Build labels to select
	switch input.Type {
	case models.MetricsTypeTeam:
		sumBy = prometheus.MetricsFilterSumByProject
		metricsFilters.TeamID = team.ID
	case models.MetricsTypeProject:
		sumBy = prometheus.MetricsFilterSumByEnvironment
		metricsFilters.ProjectID = project.ID
	case models.MetricsTypeEnvironment:
		sumBy = prometheus.MetricsFilterSumByService
		metricsFilters.EnvironmentID = environment.ID
		// Get services in this environment
		services, err := self.repo.Service().GetByEnvironmentID(ctx, environment.ID, nil, false)
		if err != nil {
			return nil, err
		}
		metricsFilters.ServiceIDs = make([]uuid.UUID, len(services))
		for i, s := range services {
			metricsFilters.ServiceIDs[i] = s.ID
		}
	case models.MetricsTypeService:
		sumBy = prometheus.MetricsFilterSumByService
		metricsFilters.ServiceIDs = []uuid.UUID{service.ID}
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
		10 * time.Second,
		15 * time.Second,
		30 * time.Second,
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
	rawMetrics, err := self.promClient.GetResourceMetrics(ctx, sumBy, start, end, step, &metricsFilters)
	if err != nil {
		return nil, fmt.Errorf("error getting metrics: %w", err)
	}

	// Convert to our format
	return models.TransformMetricsEntity(rawMetrics, step, sumBy), nil
}

func chooseStep(duration time.Duration, targetSteps int64, steps []time.Duration) time.Duration {
	if len(steps) == 0 {
		return 1 * time.Hour
	}

	bestStep := steps[0]
	bestDiff := math.MaxFloat64

	for _, step := range steps {
		count := duration.Milliseconds() / step.Milliseconds()
		diff := math.Abs(float64(count - targetSteps))
		if diff < bestDiff {
			bestDiff = diff
			bestStep = step
		}
	}
	return bestStep
}
