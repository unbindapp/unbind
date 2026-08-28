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

const (
	defaultQueryLimit = 500
	maxQueryLimit     = 1000
	// level filtering happens post-fetch, so scan a few extra pages to fill the limit
	maxLevelFilterPages = 5
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
	if direction == loki.LokiDirectionForward && len(filters.levels) > 0 {
		return nil, errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "levels filtering requires backward direction")
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

	limit := input.Limit
	if limit <= 0 {
		limit = defaultQueryLimit
	}
	if limit > maxQueryLimit {
		limit = maxQueryLimit
	}

	baseOpts := loki.LokiLogHTTPOptions{
		Label:      selector.label,
		LabelValue: selector.labelValue,
		ServiceIDs: filters.serviceIDs,
		RawFilter:  filters.compiledSearch,
		Direction:  &direction,
	}
	if !startTime.IsZero() {
		baseOpts.Start = &startTime
	}
	if !end.IsZero() {
		baseOpts.End = &end
	}

	if len(filters.levels) == 0 {
		opts := baseOpts
		opts.Limit = &limit
		events, err := self.lokiQuerier.QueryLokiLogs(ctx, opts)
		if err != nil {
			return nil, err
		}
		return &LogQueryResult{
			Data:       events,
			NextCursor: cursorFromOldest(events, direction, len(events) >= limit),
		}, nil
	}

	return self.queryWithLevelFilter(ctx, baseOpts, filters.levels, limit)
}

// queryWithLevelFilter pages backward through loki until enough matching lines
// are collected, since level is derived per line and can't be pushed into LogQL.
func (self *LogsService) queryWithLevelFilter(ctx context.Context, baseOpts loki.LokiLogHTTPOptions, levels []loki.LogLevel, limit int) (*LogQueryResult, error) {
	collected := []loki.LogEvent{}
	moreAvailable := false
	pageEnd := baseOpts.End
	var oldestScanned time.Time

	for page := 0; page < maxLevelFilterPages; page++ {
		pageLimit := maxQueryLimit
		if page == 0 && limit*2 < maxQueryLimit {
			pageLimit = limit * 2
		}
		opts := baseOpts
		opts.Limit = &pageLimit
		opts.End = pageEnd

		events, err := self.lokiQuerier.QueryLokiLogs(ctx, opts)
		if err != nil {
			return nil, err
		}

		collected = append(collected, loki.FilterEventsByLevel(events, levels)...)

		if len(events) < pageLimit {
			moreAvailable = false
			break
		}
		moreAvailable = true
		oldestScanned = events[len(events)-1].Timestamp
		if len(collected) >= limit {
			break
		}
		// events are newest-first; continue strictly before the oldest scanned line
		pageEnd = &oldestScanned
	}

	trimmed := len(collected) > limit
	if trimmed {
		collected = collected[:limit]
	}

	// after a trim the cursor must restart from the oldest returned match so the
	// trimmed matches aren't skipped; otherwise continue from the scan position
	nextCursor := ""
	switch {
	case trimmed:
		nextCursor = cursorFromOldest(collected, loki.LokiDirectionBackward, true)
	case moreAvailable && !oldestScanned.IsZero():
		nextCursor = strconv.FormatInt(oldestScanned.UnixNano(), 10)
	}
	return &LogQueryResult{Data: collected, NextCursor: nextCursor}, nil
}

func cursorFromOldest(events []loki.LogEvent, direction loki.LokiDirection, moreAvailable bool) string {
	if direction != loki.LokiDirectionBackward || !moreAvailable || len(events) == 0 {
		return ""
	}
	oldest := events[len(events)-1].Timestamp
	return strconv.FormatInt(oldest.UnixNano(), 10)
}
