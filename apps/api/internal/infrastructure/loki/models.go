package loki

import (
	"encoding/json"
	"reflect"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

type LokiLabelName string

const (
	LokiLabelTeam        LokiLabelName = "unbind_team"
	LokiLabelProject     LokiLabelName = "unbind_project"
	LokiLabelEnvironment LokiLabelName = "unbind_environment"
	LokiLabelService     LokiLabelName = "unbind_service"
	LokiLabelDeployment  LokiLabelName = "unbind_deployment"
	LokiLabelBuild       LokiLabelName = "unbind_deployment_build"
)

// LokiLogStreamOptions represents options for filtering and streaming logs from Loki
type LokiLogStreamOptions struct {
	Label             LokiLabelName // Label to filter logs by
	LabelValue        string        // Value of the label to filter logs by
	RawFilter         string        // Raw logql filter string
	Since             time.Duration // Get logs from this time ago
	Limit             int           // Number of log lines to get
	Start             time.Time     // Get logs from a specific time
	HeartbeatInterval time.Duration // Interval for sending heartbeat messages (defaults to 10s if not set)
}

// LokiLogOptions represents options for querying logs from Loki query and query_range APIs
type LokiLogHTTPOptions struct {
	Label      LokiLabelName // Label to filter logs by
	LabelValue string        // Value of the label to filter logs by
	RawFilter  string        // Raw logql filter string
	// * Query range options
	Start *time.Time     // Start time for the query
	End   *time.Time     // End time for the query
	Since *time.Duration // Get logs from this time ago
	// * Query options
	Time *time.Time // Time for the query
	// * Shared options
	Limit     *int           // Number of log lines to get
	Direction *LokiDirection // Direction of the logs (forward or backward)
}

type LogMetadata struct {
	// Metadata to stick on
	ServiceID     string `json:"service_id,omitempty"`
	TeamID        string `json:"team_id,omitempty"`
	ProjectID     string `json:"project_id,omitempty"`
	EnvironmentID string `json:"environment_id,omitempty"`
	DeploymentID  string `json:"deployment_id,omitempty"`
}

type LogEventsMessageType string

const (
	LogEventsMessageTypeLog       LogEventsMessageType = "log"
	LogEventsMessageTypeHeartbeat LogEventsMessageType = "heartbeat"
	LogEventsMessageTypeError     LogEventsMessageType = "error"
)

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u LogEventsMessageType) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["LogEventsMessageType"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "LogEventsMessageType")
		schemaRef.Title = "LogEventsMessageType"
		schemaRef.Enum = append(schemaRef.Enum, string(LogEventsMessageTypeLog))
		schemaRef.Enum = append(schemaRef.Enum, string(LogEventsMessageTypeHeartbeat))
		schemaRef.Enum = append(schemaRef.Enum, string(LogEventsMessageTypeError))
		r.Map()["LogEventsMessageType"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/LogEventsMessageType"}
}

type LogEvents struct {
	MessageType LogEventsMessageType `json:"type"`
	// LogEvents is a slice of log events
	Logs []LogEvent `json:"logs"`
	// Error message
	ErrorMessage string `json:"error_message,omitempty"`
}

// LogEvent represents a log line event sent via SSE
type LogEvent struct {
	PodName   string      `json:"pod_name"`
	Timestamp time.Time   `json:"timestamp,omitempty"`
	Message   string      `json:"message"`
	Metadata  LogMetadata `json:"metadata"`
}

// LokiStreamResponse represents the format of a Loki log stream response
type LokiStreamResponse struct {
	Streams []struct {
		Stream map[string]string `json:"stream"`
		Values [][2]string       `json:"values"` // [timestamp, message]
	} `json:"streams"`
}

// LokiDirection represents the direction in which to return logs, loki defaults to backward
type LokiDirection string

const (
	LokiDirectionForward  LokiDirection = "forward"
	LokiDirectionBackward LokiDirection = "backward"
)

// Values provides list valid values for Enum.
func (LokiDirection) Values() (kinds []string) {
	return []string{
		string(LokiDirectionForward),
		string(LokiDirectionBackward),
	}
}

// Register enum in OpenAPI specification
// https://github.com/danielgtaylor/huma/issues/621
func (u LokiDirection) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["LokiDirection"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "LokiDirection")
		schemaRef.Title = "LokiDirection"
		schemaRef.Enum = append(schemaRef.Enum, string(LokiDirectionForward))
		schemaRef.Enum = append(schemaRef.Enum, string(LokiDirectionBackward))
		r.Map()["LokiDirection"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/LokiDirection"}
}

// * HTTP API Responses
// LokiQueryResponse represents the response structure from Loki HTTP API
type LokiQueryResponse struct {
	Status    string        `json:"status"`
	Data      LokiQueryData `json:"data"`
	ErrorType string        `json:"errorType,omitempty"`
	Error     string        `json:"error,omitempty"`
}

// LokiQueryData contains the query result data
type LokiQueryData struct {
	ResultType string          `json:"resultType"`
	Result     json.RawMessage `json:"result"`
	Stats      json.RawMessage `json:"stats,omitempty"`
}

// StreamValue represents a single log entry in a stream
type StreamValue []string // [timestamp, message]

// Stream represents a stream of logs for a specific set of labels
type Stream struct {
	Stream map[string]string `json:"stream"`
	Values []StreamValue     `json:"values"`
}

// MatrixSample represents a sample in a matrix result
type MatrixSample struct {
	Timestamp int64   `json:"timestamp"`
	Value     float64 `json:"value,string"`
}

// MatrixValue represents a series in a matrix result
type MatrixValue struct {
	Metric map[string]string `json:"metric"`
	Values []MatrixSample    `json:"values"`
}

// VectorSample represents a sample in a vector result
type VectorSample struct {
	Timestamp int64   `json:"timestamp"`
	Value     float64 `json:"value,string"`
}

// VectorValue represents an instant vector sample
type VectorValue struct {
	Metric map[string]string `json:"metric"`
	Value  VectorSample      `json:"value"`
}
