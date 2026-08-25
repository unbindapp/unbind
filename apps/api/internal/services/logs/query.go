package logs_service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/infrastructure/loki"
	"github.com/unbindapp/unbind-api/internal/models"
)

func (self *LogsService) QueryLogs(ctx context.Context, requesterUserID uuid.UUID, input *models.LogQueryInput) ([]loki.LogEvent, error) {
	team, project, environment, service, err := self.validatePermissionsAndParseInputs(ctx, requesterUserID, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID)
	if err != nil {
		return nil, err
	}

	selector, err := self.resolveLokiSelector(ctx, input.Type, input.DeploymentID, team, project, environment, service)
	if err != nil {
		return nil, err
	}

	// Parse 'since' duration
	var sinceDuration time.Duration
	if input.Since != "" {
		sinceDuration, err = time.ParseDuration(input.Since)
		if err != nil {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "invalid since duration")
		}
	}

	startTime, sinceDuration := clampLogStart(input.Start, sinceDuration, selector.startBound)

	var since *time.Duration
	var start *time.Time
	var end *time.Time
	var limit *int
	var direction *loki.LokiDirection
	if sinceDuration > 0 {
		since = &sinceDuration
	}
	if !startTime.IsZero() {
		start = &startTime
	}
	if !input.End.IsZero() {
		end = &input.End
	}
	if input.Limit != 0 {
		limit = &input.Limit
	}
	if input.Direction != "" {
		direction = &input.Direction
	}
	lokiLogOptions := loki.LokiLogHTTPOptions{
		Label:      selector.label,
		LabelValue: selector.labelValue,
		RawFilter:  input.Filters,
		Since:      since,
		Start:      start,
		End:        end,
		Limit:      limit,
		Direction:  direction,
	}

	return self.lokiQuerier.QueryLokiLogs(ctx, lokiLogOptions)
}
