package logs_service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/infrastructure/loki"
	"github.com/unbindapp/unbind-api/internal/models"
)

func TestParseLogFilters(t *testing.T) {
	t.Run("empty inputs", func(t *testing.T) {
		filters, err := parseLogFilters(models.LogTypeService, "", "", "")
		require.NoError(t, err)
		assert.Empty(t, filters.compiledSearch)
		assert.Empty(t, filters.levels)
		assert.Empty(t, filters.serviceIDs)
	})

	t.Run("search compiles", func(t *testing.T) {
		filters, err := parseLogFilters(models.LogTypeService, "timeout", "", "")
		require.NoError(t, err)
		assert.Equal(t, `|~ "(?i)timeout"`, filters.compiledSearch)
	})

	t.Run("invalid search rejected", func(t *testing.T) {
		_, err := parseLogFilters(models.LogTypeService, `"unclosed`, "", "")
		assert.Error(t, err)
	})

	t.Run("levels parsed", func(t *testing.T) {
		filters, err := parseLogFilters(models.LogTypeService, "", "error, warning", "")
		require.NoError(t, err)
		assert.Equal(t, []loki.LogLevel{loki.LogLevelError, loki.LogLevelWarn}, filters.levels)
	})

	t.Run("all levels normalizes to no filter", func(t *testing.T) {
		filters, err := parseLogFilters(models.LogTypeService, "", "debug,info,warning,error", "")
		require.NoError(t, err)
		assert.Empty(t, filters.levels)
	})

	t.Run("invalid level rejected", func(t *testing.T) {
		_, err := parseLogFilters(models.LogTypeService, "", "verbose", "")
		assert.Error(t, err)
	})

	t.Run("service ids on environment scope", func(t *testing.T) {
		a, b := uuid.New(), uuid.New()
		filters, err := parseLogFilters(models.LogTypeEnvironment, "", "", a.String()+","+b.String())
		require.NoError(t, err)
		assert.Equal(t, []string{a.String(), b.String()}, filters.serviceIDs)
	})

	t.Run("service ids rejected for service scope", func(t *testing.T) {
		_, err := parseLogFilters(models.LogTypeService, "", "", uuid.New().String())
		assert.Error(t, err)
	})

	t.Run("non-uuid service id rejected", func(t *testing.T) {
		_, err := parseLogFilters(models.LogTypeEnvironment, "", "", "not-a-uuid")
		assert.Error(t, err)
	})
}

func TestCursorFromOldest(t *testing.T) {
	ts := time.Unix(0, 1700000000000000000)
	events := []loki.LogEvent{
		{Timestamp: ts.Add(time.Second)},
		{Timestamp: ts},
	}

	t.Run("backward with more", func(t *testing.T) {
		cursor := cursorFromOldest(events, loki.LokiDirectionBackward, true)
		assert.Equal(t, strconv.FormatInt(ts.UnixNano(), 10), cursor)
	})

	t.Run("no more available", func(t *testing.T) {
		assert.Empty(t, cursorFromOldest(events, loki.LokiDirectionBackward, false))
	})

	t.Run("forward never pages", func(t *testing.T) {
		assert.Empty(t, cursorFromOldest(events, loki.LokiDirectionForward, true))
	})

	t.Run("empty events", func(t *testing.T) {
		assert.Empty(t, cursorFromOldest(nil, loki.LokiDirectionBackward, true))
	})
}

// lokiPage builds a query_range response with count lines ending (newest) at
// newestNs, stepping 1ms per line. Every other line is an error-level message.
func lokiPage(newestNs int64, count int) string {
	values := make([][2]string, count)
	for i := 0; i < count; i++ {
		ns := newestNs - int64(i)*int64(time.Millisecond)
		message := fmt.Sprintf("plain line %d", i)
		if i%2 == 0 {
			message = fmt.Sprintf("error line %d", i)
		}
		values[i] = [2]string{strconv.FormatInt(ns, 10), message}
	}
	page := map[string]any{
		"status": "success",
		"data": map[string]any{
			"resultType": "streams",
			"result": []map[string]any{
				{"stream": map[string]string{"instance": "pod-1"}, "values": values},
			},
		},
	}
	out, _ := json.Marshal(page)
	return string(out)
}

func newTestLogsService(t *testing.T, handler http.HandlerFunc) *LogsService {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	querier, err := loki.NewLokiLogger(&config.Config{LokiEndpoint: server.URL})
	require.NoError(t, err)
	return &LogsService{lokiQuerier: querier}
}

func TestQueryWithLevelFilter(t *testing.T) {
	newestNs := time.Now().UnixNano()

	t.Run("single page exhausts range", func(t *testing.T) {
		var requests []string
		svc := newTestLogsService(t, func(w http.ResponseWriter, r *http.Request) {
			requests = append(requests, r.URL.RawQuery)
			fmt.Fprint(w, lokiPage(newestNs, 10))
		})

		direction := loki.LokiDirectionBackward
		result, err := svc.queryWithLevelFilter(context.Background(), loki.LokiLogHTTPOptions{
			Label:      loki.LokiLabelService,
			LabelValue: "svc-1",
			Direction:  &direction,
		}, []loki.LogLevel{loki.LogLevelError}, 100)

		require.NoError(t, err)
		assert.Len(t, requests, 1)
		assert.Len(t, result.Data, 5)
		assert.Empty(t, result.NextCursor, "exhausted range has no cursor")
		for _, event := range result.Data {
			assert.Equal(t, loki.LogLevelError, event.Level)
		}
	})

	t.Run("pages until limit and returns cursor", func(t *testing.T) {
		var capturedEnds []string
		page := 0
		svc := newTestLogsService(t, func(w http.ResponseWriter, r *http.Request) {
			capturedEnds = append(capturedEnds, r.URL.Query().Get("end"))
			// two full pages: 1000 lines each, 500 errors per page
			fmt.Fprint(w, lokiPage(newestNs-int64(page)*int64(time.Hour), 1000))
			page++
		})

		direction := loki.LokiDirectionBackward
		result, err := svc.queryWithLevelFilter(context.Background(), loki.LokiLogHTTPOptions{
			Label:      loki.LokiLabelService,
			LabelValue: "svc-1",
			Direction:  &direction,
		}, []loki.LogLevel{loki.LogLevelError}, 800)

		require.NoError(t, err)
		assert.Len(t, capturedEnds, 2)
		assert.Empty(t, capturedEnds[0])
		// second request continues from the oldest scanned line of page one
		expectedEnd := newestNs - 999*int64(time.Millisecond)
		assert.Equal(t, strconv.FormatInt(expectedEnd, 10), capturedEnds[1])

		assert.Len(t, result.Data, 800)
		require.NotEmpty(t, result.NextCursor)
		oldestReturned := result.Data[len(result.Data)-1].Timestamp.UnixNano()
		assert.Equal(t, strconv.FormatInt(oldestReturned, 10), result.NextCursor)
	})

	t.Run("page cap keeps a cursor even with zero matches", func(t *testing.T) {
		requests := 0
		var lastPageNewest int64
		svc := newTestLogsService(t, func(w http.ResponseWriter, r *http.Request) {
			// full pages with zero matching lines
			lastPageNewest = newestNs - int64(requests)*int64(time.Hour)
			fmt.Fprint(w, lokiPage(lastPageNewest, 1000))
			requests++
		})

		direction := loki.LokiDirectionBackward
		result, err := svc.queryWithLevelFilter(context.Background(), loki.LokiLogHTTPOptions{
			Label:      loki.LokiLabelService,
			LabelValue: "svc-1",
			Direction:  &direction,
		}, []loki.LogLevel{loki.LogLevelDebug}, 100)

		require.NoError(t, err)
		assert.Equal(t, maxLevelFilterPages, requests)
		assert.NotNil(t, result.Data)
		assert.Empty(t, result.Data)
		// older logs may still match; the cursor continues from the scan position
		expectedCursor := lastPageNewest - 999*int64(time.Millisecond)
		assert.Equal(t, strconv.FormatInt(expectedCursor, 10), result.NextCursor)
	})

	t.Run("first page is sized to the requested limit", func(t *testing.T) {
		var capturedLimits []string
		svc := newTestLogsService(t, func(w http.ResponseWriter, r *http.Request) {
			capturedLimits = append(capturedLimits, r.URL.Query().Get("limit"))
			fmt.Fprint(w, lokiPage(newestNs, 10))
		})

		direction := loki.LokiDirectionBackward
		_, err := svc.queryWithLevelFilter(context.Background(), loki.LokiLogHTTPOptions{
			Label:      loki.LokiLabelService,
			LabelValue: "svc-1",
			Direction:  &direction,
		}, []loki.LogLevel{loki.LogLevelError}, 50)

		require.NoError(t, err)
		assert.Equal(t, []string{"100"}, capturedLimits)
	})
}
