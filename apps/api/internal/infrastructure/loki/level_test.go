package loki

import (
	"fmt"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLevelFromDetected(t *testing.T) {
	tests := []struct {
		detected string
		want     LogLevel
	}{
		{detected: "trace", want: LogLevelDebug},
		{detected: "debug", want: LogLevelDebug},
		{detected: "info", want: LogLevelInfo},
		{detected: "warn", want: LogLevelWarn},
		{detected: "error", want: LogLevelError},
		{detected: "critical", want: LogLevelError},
		{detected: "fatal", want: LogLevelError},
		// loki's bucket for lines it could not classify
		{detected: "unknown", want: LogLevelInfo},
		// lines ingested before level discovery carry no value at all
		{detected: "", want: LogLevelInfo},
		{detected: "ERROR", want: LogLevelError},
		{detected: "  Warn  ", want: LogLevelWarn},
		// anything outside loki's vocabulary lands where unclassified lines do
		{detected: "notice", want: LogLevelInfo},
	}

	for _, tt := range tests {
		t.Run(tt.detected, func(t *testing.T) {
			assert.Equal(t, tt.want, LevelFromDetected(tt.detected))
		})
	}
}

func TestLevelForEntry(t *testing.T) {
	tests := []struct {
		name         string
		streamLabels map[string]string
		entry        StreamValue
		want         LogLevel
	}{
		{
			name:         "stream labels carry the level by default",
			streamLabels: map[string]string{"instance": "pod-1", DetectedLevelLabel: "error"},
			entry:        StreamValue{Line: "boom"},
			want:         LogLevelError,
		},
		{
			name:         "entry metadata wins when loki categorizes labels",
			streamLabels: map[string]string{DetectedLevelLabel: "info"},
			entry:        StreamValue{Line: "boom", Metadata: map[string]string{DetectedLevelLabel: "warn"}},
			want:         LogLevelWarn,
		},
		{
			name:         "an empty entry value falls back to the stream",
			streamLabels: map[string]string{DetectedLevelLabel: "warn"},
			entry:        StreamValue{Line: "boom", Metadata: map[string]string{DetectedLevelLabel: ""}},
			want:         LogLevelWarn,
		},
		{
			name:         "no level anywhere reads as info",
			streamLabels: map[string]string{"instance": "pod-1"},
			entry:        StreamValue{Line: "boom"},
			want:         LogLevelInfo,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, levelForEntry(tt.streamLabels, tt.entry))
		})
	}
}

func TestDetectedLevelValuesPartition(t *testing.T) {
	seen := map[string]LogLevel{}
	for level, values := range detectedLevelValues {
		for _, value := range values {
			existing, duplicate := seen[value]
			require.False(t, duplicate, "%q claimed by both %s and %s", value, existing, level)
			seen[value] = level
		}
	}

	// every value loki can emit has to land somewhere, or filtering on the
	// level that owns it would silently drop lines
	for _, value := range []string{"trace", "debug", "info", "warn", "error", "critical", "fatal", "unknown"} {
		_, ok := seen[value]
		assert.True(t, ok, "loki emits %q but no level claims it", value)
	}
}

func TestDetectedLevelFilter(t *testing.T) {
	tests := []struct {
		name   string
		levels []LogLevel
		want   string
	}{
		{name: "no levels", levels: nil, want: ""},
		{
			name:   "every level matches everything",
			levels: []LogLevel{LogLevelDebug, LogLevelInfo, LogLevelWarn, LogLevelError},
			want:   "",
		},
		{
			name:   "error",
			levels: []LogLevel{LogLevelError},
			want:   `| detected_level=~"error|critical|fatal"`,
		},
		{
			name:   "warning",
			levels: []LogLevel{LogLevelWarn},
			want:   `| detected_level=~"warn"`,
		},
		{
			name:   "info keeps unclassified lines",
			levels: []LogLevel{LogLevelInfo},
			want:   `| detected_level=~"info|unknown|"`,
		},
		{
			name:   "debug",
			levels: []LogLevel{LogLevelDebug},
			want:   `| detected_level=~"trace|debug"`,
		},
		{
			name:   "selection order does not matter",
			levels: []LogLevel{LogLevelError, LogLevelWarn},
			want:   `| detected_level=~"warn|error|critical|fatal"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, detectedLevelFilter(tt.levels))
		})
	}
}

// LogQL anchors label filter regexes, so each alternative has to match a whole
// value and nothing else.
func TestDetectedLevelFilterMatchesAnchored(t *testing.T) {
	filter := detectedLevelFilter([]LogLevel{LogLevelWarn})
	pattern := strings.Trim(strings.TrimPrefix(filter, "| detected_level=~"), `"`)

	re, err := regexp.Compile(fmt.Sprintf("^(?:%s)$", pattern))
	require.NoError(t, err)

	assert.True(t, re.MatchString("warn"))
	assert.False(t, re.MatchString("warning"), "anchoring must not let warn match warning")
	assert.False(t, re.MatchString("error"))
}

func TestDetectedLevelFilterInfoMatchesMissingValue(t *testing.T) {
	filter := detectedLevelFilter([]LogLevel{LogLevelInfo})
	pattern := strings.Trim(strings.TrimPrefix(filter, "| detected_level=~"), `"`)

	re, err := regexp.Compile(fmt.Sprintf("^(?:%s)$", pattern))
	require.NoError(t, err)

	assert.True(t, re.MatchString("info"))
	assert.True(t, re.MatchString("unknown"))
	// loki reads a label that is not set as empty
	assert.True(t, re.MatchString(""))
	assert.False(t, re.MatchString("error"))
}

func TestParseLogLevel(t *testing.T) {
	for _, valid := range []string{"debug", "info", "warning", " WARNING ", "error", "Error"} {
		_, ok := ParseLogLevel(valid)
		assert.True(t, ok, valid)
	}
	// "warn" is loki's spelling of the level, the api's is "warning"
	for _, invalid := range []string{"", "warn", "critical", "all"} {
		_, ok := ParseLogLevel(invalid)
		assert.False(t, ok, invalid)
	}
}
