package models

import (
	"reflect"

	"github.com/danielgtaylor/huma/v2"
)

// EventType represents different types of pod/container events
type EventType string

const (
	EventTypeOOMKilled        EventType = "oom_killed"
	EventTypeCrashLoopBackOff EventType = "crash_loop_back_off"
	EventTypeContainerCreated EventType = "container_created"
	EventTypeContainerStarted EventType = "container_started"
	EventTypeContainerStopped EventType = "container_stopped"
	EventTypeImagePullBackOff EventType = "image_pull_back_off"
	EventTypeNodeNotReady     EventType = "node_not_ready"
	EventTypeSchedulingFailed EventType = "scheduling_failed"
	EventTypeUnknown          EventType = "unknown"
)

// Register enum in OpenAPI specification
func (e EventType) Schema(r huma.Registry) *huma.Schema {
	if r.Map()["EventType"] == nil {
		schemaRef := r.Schema(reflect.TypeOf(""), true, "EventType")
		schemaRef.Title = "EventType"
		schemaRef.Enum = append(schemaRef.Enum, string(EventTypeOOMKilled))
		schemaRef.Enum = append(schemaRef.Enum, string(EventTypeCrashLoopBackOff))
		schemaRef.Enum = append(schemaRef.Enum, string(EventTypeContainerCreated))
		schemaRef.Enum = append(schemaRef.Enum, string(EventTypeContainerStarted))
		schemaRef.Enum = append(schemaRef.Enum, string(EventTypeContainerStopped))
		schemaRef.Enum = append(schemaRef.Enum, string(EventTypeNodeNotReady))
		schemaRef.Enum = append(schemaRef.Enum, string(EventTypeSchedulingFailed))
		schemaRef.Enum = append(schemaRef.Enum, string(EventTypeUnknown))
		r.Map()["EventType"] = schemaRef
	}
	return &huma.Schema{Ref: "#/components/schemas/EventType"}
}

// models.EventRecord represents a single event with its details
type EventRecord struct {
	Type      EventType `json:"type"`
	Timestamp string    `json:"timestamp"`
	Message   string    `json:"message,omitempty"`
	Count     int32     `json:"count,omitempty"`
	FirstSeen string    `json:"first_seen,omitempty"`
	LastSeen  string    `json:"last_seen,omitempty"`
	Reason    string    `json:"reason,omitempty"`
}
