package logs_service

import (
	"context"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/danielgtaylor/huma/v2/sse"
	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/internal/common/errdefs"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/infrastructure/loki"
	"github.com/unbindapp/unbind-api/internal/models"
)

const (
	streamInitialBackoff     = time.Second
	streamMaxBackoff         = 30 * time.Second
	streamStableConnDuration = 30 * time.Second
	streamFailuresBeforeWarn = 3
)

func (self *LogsService) StreamLogs(ctx context.Context, requesterUserID uuid.UUID, input *models.LogStreamInput, send sse.Sender) error {
	team, project, environment, service, err := self.validatePermissionsAndParseInputs(ctx, requesterUserID, input.Type, input.TeamID, input.ProjectID, input.EnvironmentID, input.ServiceID)
	if err != nil {
		return err
	}

	selector, err := self.resolveLokiSelector(ctx, input.Type, input.DeploymentID, team, project, environment, service)
	if err != nil {
		return err
	}

	filters, err := parseLogFilters(input.Type, input.Search, input.Levels, input.ServiceIDs)
	if err != nil {
		return err
	}

	var since time.Duration
	if input.Since != "" {
		since, err = time.ParseDuration(input.Since)
		if err != nil {
			return errdefs.NewCustomError(errdefs.ErrTypeInvalidInput, "invalid since duration")
		}
	}

	start, since := clampLogStart(input.Start, since, selector.startBound)

	eventChan := make(chan loki.LogEvents, 100)

	streamCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	baseOpts := loki.LokiLogStreamOptions{
		Label:      selector.label,
		LabelValue: selector.labelValue,
		ServiceIDs: filters.serviceIDs,
		Levels:     filters.levels,
		RawFilter:  filters.compiledSearch,
		Limit:      int(input.Limit),
		Since:      since,
		Start:      start,
	}

	// Track the newest delivered timestamp so reconnects (ours or the
	// client's via Last-Event-Id) resume instead of replaying history.
	var lastEventNs atomic.Int64
	if cursor, ok := parseEventCursor(input.LastEventID); ok {
		lastEventNs.Store(cursor)
	}

	go self.runLokiStream(streamCtx, baseOpts, &lastEventNs, eventChan)

	// Comment lines are the standard SSE keep-alive: clients must ignore them
	// (https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation).
	keepAlive := time.NewTicker(10 * time.Second)
	defer keepAlive.Stop()

	for {
		select {
		case event := <-eventChan:
			id := 0
			if event.MessageType == loki.LogEventsMessageTypeLog {
				if ns := latestEventNs(event); ns > lastEventNs.Load() {
					lastEventNs.Store(ns)
				}
				id = int(lastEventNs.Load())
			}
			_ = send(sse.Message{ID: id, Data: event})
		case <-keepAlive.C:
			_ = send.Comment("keep-alive")
		case <-ctx.Done():
			return nil
		}
	}
}

// runLokiStream keeps the Loki tail alive, reconnecting with backoff and
// resuming from the last delivered timestamp. Persistent failures surface as a
// single error event while retries continue in the background.
func (self *LogsService) runLokiStream(ctx context.Context, baseOpts loki.LokiLogStreamOptions, lastEventNs *atomic.Int64, eventChan chan<- loki.LogEvents) {
	defer func() {
		if r := recover(); r != nil {
			log.Errorf("Recovered from panic in log streaming goroutine: %v", r)
		}
	}()

	backoff := streamInitialBackoff
	failures := 0

	for {
		opts := baseOpts
		if ns := lastEventNs.Load(); ns > 0 {
			opts.Start = time.Unix(0, ns+1)
			opts.Since = 0
		}

		connectedAt := time.Now()
		err := self.lokiQuerier.StreamLokiPodLogs(ctx, opts, eventChan)
		if ctx.Err() != nil {
			return
		}

		if time.Since(connectedAt) > streamStableConnDuration {
			failures = 0
			backoff = streamInitialBackoff
		} else {
			failures++
		}

		if err != nil {
			log.Warnf("Loki stream disconnected (attempt %d): %v", failures, err)
		}
		if failures == streamFailuresBeforeWarn {
			select {
			case eventChan <- loki.LogEvents{
				MessageType:  loki.LogEventsMessageTypeError,
				ErrorMessage: "Log stream interrupted, retrying in the background",
			}:
			case <-ctx.Done():
				return
			}
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		if backoff < streamMaxBackoff {
			backoff *= 2
		}
	}
}

func parseEventCursor(lastEventID string) (int64, bool) {
	if lastEventID == "" {
		return 0, false
	}
	nanos, err := strconv.ParseInt(lastEventID, 10, 64)
	if err != nil || nanos <= 0 {
		return 0, false
	}
	return nanos, true
}

func latestEventNs(event loki.LogEvents) int64 {
	var latest int64
	for _, l := range event.Logs {
		if ns := l.Timestamp.UnixNano(); ns > latest {
			latest = ns
		}
	}
	return latest
}
