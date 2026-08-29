package loki

import (
	"encoding/json"
	"reflect"
	"regexp"
	"strings"

	"github.com/danielgtaylor/huma/v2"
)

type LogLevel string

const (
	LogLevelDebug LogLevel = "debug"
	LogLevelInfo  LogLevel = "info"
	LogLevelWarn  LogLevel = "warning"
	LogLevelError LogLevel = "error"
)

var LogLevelValues = []LogLevel{
	LogLevelDebug,
	LogLevelInfo,
	LogLevelWarn,
	LogLevelError,
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u LogLevel) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["LogLevel"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "LogLevel")
		schemaRef.Title = "LogLevel"
		for _, v := range LogLevelValues {
			schemaRef.Enum = append(schemaRef.Enum, string(v))
		}
		r.Map()["LogLevel"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/LogLevel"}
}

func ParseLogLevel(s string) (LogLevel, bool) {
	switch LogLevel(strings.ToLower(strings.TrimSpace(s))) {
	case LogLevelDebug:
		return LogLevelDebug, true
	case LogLevelInfo:
		return LogLevelInfo, true
	case LogLevelWarn:
		return LogLevelWarn, true
	case LogLevelError:
		return LogLevelError, true
	default:
		return "", false
	}
}

var (
	ansiPattern  = regexp.MustCompile(`\x1b\[[0-9;]*m`)
	errorPattern = regexp.MustCompile(`(?i)(^|[^a-zA-Z0-9])(error|err|fatal|fail|failed|failure|panic|exception|critical)($|[^a-zA-Z0-9])`)
	warnPattern  = regexp.MustCompile(`(?i)(^|[^a-zA-Z0-9])(warn|warning)($|[^a-zA-Z0-9])`)
	debugPattern = regexp.MustCompile(`(?i)(^|[^a-zA-Z0-9])(debug|trace)($|[^a-zA-Z0-9])`)
)

// only the level-ish keys are decoded, so other fields cost nothing per line
type jsonLevelFields struct {
	Level    json.RawMessage `json:"level"`
	Severity json.RawMessage `json:"severity"`
	Lvl      json.RawMessage `json:"lvl"`
	ECSLevel json.RawMessage `json:"log.level"`
}

// pino/bunyan-style numeric levels
func levelFromNumber(n float64) (LogLevel, bool) {
	switch {
	case n <= 0:
		return "", false
	case n < 30:
		return LogLevelDebug, true
	case n < 40:
		return LogLevelInfo, true
	case n < 50:
		return LogLevelWarn, true
	case n <= 100:
		return LogLevelError, true
	default:
		return "", false
	}
}

func levelFromString(s string) (LogLevel, bool) {
	switch strings.ToLower(s) {
	case "trace", "debug", "dbg", "fine", "finer", "finest":
		return LogLevelDebug, true
	case "info", "information", "notice", "log":
		return LogLevelInfo, true
	case "warn", "warning":
		return LogLevelWarn, true
	case "error", "err", "fatal", "panic", "crit", "critical", "alert", "emerg", "emergency", "severe":
		return LogLevelError, true
	default:
		return "", false
	}
}

func levelFromJSON(message string) (LogLevel, bool) {
	trimmed := strings.TrimSpace(message)
	if !strings.HasPrefix(trimmed, "{") {
		return "", false
	}

	var fields jsonLevelFields
	if err := json.Unmarshal([]byte(trimmed), &fields); err != nil {
		return "", false
	}

	for _, raw := range [][]byte{fields.Level, fields.Severity, fields.Lvl, fields.ECSLevel} {
		if raw == nil {
			continue
		}
		var asString string
		if err := json.Unmarshal(raw, &asString); err == nil {
			if level, ok := levelFromString(asString); ok {
				return level, true
			}
			continue
		}
		var asNumber float64
		if err := json.Unmarshal(raw, &asNumber); err == nil {
			if level, ok := levelFromNumber(asNumber); ok {
				return level, true
			}
		}
	}
	return "", false
}

// DetectLevel derives a log level from a raw log line: a JSON level field wins,
// otherwise level-ish keywords in the text decide, defaulting to info.
func DetectLevel(message string) LogLevel {
	if level, ok := levelFromJSON(message); ok {
		return level
	}

	plain := message
	if strings.Contains(plain, "\x1b") {
		plain = ansiPattern.ReplaceAllString(plain, "")
	}

	if errorPattern.MatchString(plain) {
		return LogLevelError
	}
	if warnPattern.MatchString(plain) {
		return LogLevelWarn
	}
	if debugPattern.MatchString(plain) {
		return LogLevelDebug
	}
	return LogLevelInfo
}

// FilterEventsByLevel returns only the events whose level is in levels; an
// empty levels slice keeps everything.
func FilterEventsByLevel(events []LogEvent, levels []LogLevel) []LogEvent {
	if len(levels) == 0 {
		return events
	}
	allowed := make(map[LogLevel]bool, len(levels))
	for _, l := range levels {
		allowed[l] = true
	}
	filtered := make([]LogEvent, 0, len(events))
	for _, e := range events {
		if allowed[e.Level] {
			filtered = append(filtered, e)
		}
	}
	return filtered
}
