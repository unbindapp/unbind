package loki

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestDetectLevel(t *testing.T) {
	tests := []struct {
		name    string
		message string
		want    LogLevel
	}{
		{name: "plain text", message: "listening on :8080", want: LogLevelInfo},
		{name: "error keyword", message: "connection error: refused", want: LogLevelError},
		{name: "failed keyword", message: "request failed with 500", want: LogLevelError},
		{name: "panic keyword", message: "panic: nil pointer", want: LogLevelError},
		{name: "bracketed error", message: "[ERROR] something broke", want: LogLevelError},
		{name: "warn keyword", message: "WARN slow query", want: LogLevelWarn},
		{name: "warning keyword", message: "warning: deprecated flag", want: LogLevelWarn},
		{name: "debug keyword", message: "DEBUG cache miss", want: LogLevelDebug},
		{name: "trace keyword", message: "trace: entering handler", want: LogLevelDebug},
		{name: "error beats warn", message: "warning: retry failed", want: LogLevelError},
		{name: "err token", message: "err=connection reset", want: LogLevelError},
		{name: "substring not matched", message: "preferred stderrs terrors", want: LogLevelInfo},
		{name: "ansi stripped", message: "\x1b[31mERROR\x1b[0m boom", want: LogLevelError},
		{name: "json string level", message: `{"level":"warn","msg":"disk almost full"}`, want: LogLevelWarn},
		{name: "json severity", message: `{"severity":"ERROR","message":"kaput"}`, want: LogLevelError},
		{name: "json ecs level", message: `{"log.level":"debug","message":"x"}`, want: LogLevelDebug},
		{name: "json numeric pino error", message: `{"level":50,"msg":"boom"}`, want: LogLevelError},
		{name: "json numeric pino info", message: `{"level":30,"msg":"ok"}`, want: LogLevelInfo},
		{name: "json numeric pino debug", message: `{"level":20,"msg":"dbg"}`, want: LogLevelDebug},
		{name: "json level wins over keywords", message: `{"level":"info","msg":"user error handled"}`, want: LogLevelInfo},
		{name: "json without level falls back", message: `{"msg":"request failed"}`, want: LogLevelError},
		{name: "invalid json falls back", message: `{"level": broken`, want: LogLevelInfo},
		{name: "fatal string level", message: `{"level":"fatal","msg":"bye"}`, want: LogLevelError},
		{name: "notice maps to info", message: `{"level":"notice","msg":"hi"}`, want: LogLevelInfo},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, DetectLevel(tt.message), "message: %s", tt.message)
		})
	}
}

func TestParseLogLevel(t *testing.T) {
	for _, valid := range []string{"debug", "info", "warn", "error", " WARN ", "Error"} {
		_, ok := ParseLogLevel(valid)
		assert.True(t, ok, valid)
	}
	for _, invalid := range []string{"", "warning", "critical", "all"} {
		_, ok := ParseLogLevel(invalid)
		assert.False(t, ok, invalid)
	}
}

func TestFilterEventsByLevel(t *testing.T) {
	now := time.Now()
	events := []LogEvent{
		{Message: "a", Level: LogLevelInfo, Timestamp: now},
		{Message: "b", Level: LogLevelError, Timestamp: now},
		{Message: "c", Level: LogLevelWarn, Timestamp: now},
		{Message: "d", Level: LogLevelError, Timestamp: now},
	}

	t.Run("empty levels keeps all", func(t *testing.T) {
		assert.Len(t, FilterEventsByLevel(events, nil), 4)
	})

	t.Run("single level", func(t *testing.T) {
		filtered := FilterEventsByLevel(events, []LogLevel{LogLevelError})
		assert.Len(t, filtered, 2)
		assert.Equal(t, "b", filtered[0].Message)
		assert.Equal(t, "d", filtered[1].Message)
	})

	t.Run("multiple levels", func(t *testing.T) {
		filtered := FilterEventsByLevel(events, []LogLevel{LogLevelWarn, LogLevelError})
		assert.Len(t, filtered, 3)
	})

	t.Run("no matches", func(t *testing.T) {
		filtered := FilterEventsByLevel(events, []LogLevel{LogLevelDebug})
		assert.Len(t, filtered, 0)
	})
}
