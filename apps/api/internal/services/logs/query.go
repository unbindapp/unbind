package logs_service

import (
	"context"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/infrastructure/loki"
	"github.com/unbindapp/unbind-api/internal/models"
)

type LogQueryResult struct {
	Data       []loki.LogEvent
	NextCursor string
}

func (self *LogsService) QueryLogs(ctx context.Context, requesterUserID uuid.UUID, input *models.LogQueryInput) (*LogQueryResult, error) {
	team, project, environment, service, err := self.validatePermissionsAndParseInputs(ctx, requesterUserID, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID)
	if err != nil {
		return nil, err
	}

	selector, err := self.resolveLokiSelector(ctx, input.Type, input.DeploymentID, team, project, environment, service)
	if err != nil {
		return nil, err
	}

	filters, err := parseLogFilters(input.Type, input.Search, input.Levels, input.ServiceIDs)
	if err != nil {
		return nil, err
	}

	direction := input.Direction
	if direction == "" {
		direction = loki.LokiDirectionBackward
	}

	end := input.End
	if input.Cursor != "" {
		if direction != loki.LokiDirectionBackward {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "cursor is only valid with backward direction")
		}
		nanos, err := strconv.ParseInt(input.Cursor, 10, 64)
		if err != nil {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "invalid cursor")
		}
		// loki's end is exclusive, so this returns strictly older logs; lines
		// sharing the cursor's exact nanosecond are cut off with their page
		end = time.Unix(0, nanos)
	}

	var sinceDuration time.Duration
	if input.Since != "" {
		sinceDuration, err = time.ParseDuration(input.Since)
		if err != nil {
			return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "invalid since duration")
		}
	}

	startTime, sinceDuration := clampLogStart(input.Start, sinceDuration, selector.startBound)

	// resolve since against the (possibly cursor-derived) end so pagination
	// can't produce a start after the end as wall time advances
	if startTime.IsZero() && sinceDuration > 0 {
		reference := time.Now()
		if !end.IsZero() {
			reference = end
		}
		startTime = reference.Add(-sinceDuration)
	}

	// the transport declares the default and the bound; this only guards
	// callers that build the input struct directly
	limit := input.Limit
	if limit <= 0 || limit > loki.MaxQueryLimit {
		limit = loki.MaxQueryLimit
	}

	opts := loki.LokiLogHTTPOptions{
		Label:      selector.label,
		LabelValue: selector.labelValue,
		ServiceIDs: filters.serviceIDs,
		Levels:     filters.levels,
		RawFilter:  filters.compiledSearch,
		Direction:  &direction,
		Limit:      &limit,
	}
	if !startTime.IsZero() {
		opts.Start = &startTime
	}
	if !end.IsZero() {
		opts.End = &end
	}

	events, err := self.lokiQuerier.QueryLokiLogs(ctx, opts)
	if err != nil {
		return nil, err
	}
	return &LogQueryResult{
		Data:       events,
		NextCursor: cursorFromOldest(events, direction, len(events) >= limit),
	}, nil
}

func cursorFromOldest(events []loki.LogEvent, direction loki.LokiDirection, moreAvailable bool) string {
	if direction != loki.LokiDirectionBackward || !moreAvailable || len(events) == 0 {
		return ""
	}
	oldest := events[len(events)-1].Timestamp
	return strconv.FormatInt(oldest.UnixNano(), 10)
}
