package metric_service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/ent"
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/models"
	permissions_repo "github.com/unbindapp/unbind-api/internal/repositories/permissions"
)

func (self *MetricsService) GetVolumeMetrics(ctx context.Context, requesterUserID uuid.UUID, input *models.MetricsVolumeQueryInput) (*models.VolumeMetricsResult, error) {
	permissionChecks := []permissions_repo.PermissionCheck{
		//Can read team, project, environmnent, or service depending on inputs
		{
			Action:       schema.ActionViewer,
			ResourceType: schema.ResourceTypeTeam,
			ResourceID:   input.TeamID,
		},
	}

	// Check permissions
	if err := self.repo.Permissions().Check(ctx, requesterUserID, permissionChecks); err != nil {
		return nil, err
	}

	// Get team
	team, err := self.repo.Team().GetByID(ctx, input.TeamID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeNotFound, "Team not found")
		}
		return nil, err
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
	rawMetrics, err := self.promClient.GetVolumeStatsWithHistory(ctx, input.PVCID, start, end, step, team.Namespace, self.k8s.GetInternalClient())
	if err != nil {
		return nil, fmt.Errorf("error getting metrics: %w", err)
	}

	// Convert to our format
	return models.TransformVolumeStatsEntity(rawMetrics, step), nil
}
