package loki

import (
	"fmt"
	"reflect"
	"slices"
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

// DetectedLevelLabel is the structured metadata field loki attaches at ingest
// when discover_log_levels is enabled.
const DetectedLevelLabel = "detected_level"

// detectedLevelValues folds loki's detected_level vocabulary into the four
// levels the UI exposes. The buckets partition it, so every value loki emits
// lands in exactly one level and selecting all four is the same as no filter.
// The empty value covers lines ingested before level discovery was enabled.
var detectedLevelValues = map[LogLevel][]string{
	LogLevelDebug: {"trace", "debug"},
	LogLevelInfo:  {"info", "unknown", ""},
	LogLevelWarn:  {"warn"},
	LogLevelError: {"error", "critical", "fatal"},
}

// derived from detectedLevelValues so the two directions cannot drift
var levelByDetectedValue = func() map[string]LogLevel {
	byValue := make(map[string]LogLevel)
	for level, values := range detectedLevelValues {
		for _, value := range values {
			byValue[value] = level
		}
	}
	return byValue
}()

// LevelFromDetected maps a detected_level value onto the level the UI renders.
// Unrecognized values read as info, matching how loki's own "unknown" folds in.
func LevelFromDetected(detected string) LogLevel {
	if level, ok := levelByDetectedValue[strings.ToLower(strings.TrimSpace(detected))]; ok {
		return level
	}
	return LogLevelInfo
}

// detectedLevelFilter renders the LogQL structured metadata filter for levels.
// Label filter regexes are fully anchored, so each alternative matches a whole
// value. Returns "" when nothing is selected or everything is, since both match
// every line.
func detectedLevelFilter(levels []LogLevel) string {
	if len(levels) == 0 || len(levels) >= len(LogLevelValues) {
		return ""
	}

	var values []string
	for _, level := range LogLevelValues {
		if !slices.Contains(levels, level) {
			continue
		}
		values = append(values, detectedLevelValues[level]...)
	}
	if len(values) == 0 {
		return ""
	}

	return fmt.Sprintf("| %s=~%q", DetectedLevelLabel, strings.Join(values, "|"))
}
