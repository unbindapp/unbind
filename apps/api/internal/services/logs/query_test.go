package logs_service

import (
	"strconv"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
