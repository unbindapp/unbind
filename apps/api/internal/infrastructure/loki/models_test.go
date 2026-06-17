package loki

import (
	"reflect"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/stretchr/testify/suite"
)

type ModelsTestSuite struct {
	suite.Suite
}

func (suite *ModelsTestSuite) SetupTest() {
	// Setup if needed
}

func (suite *ModelsTestSuite) TearDownTest() {
	// Cleanup if needed
}

func (suite *ModelsTestSuite) TestLokiLabelName_Constants() {
	// Test that all label constants are properly defined
	suite.Equal(LokiLabelName("unbind_team"), LokiLabelTeam)
	suite.Equal(LokiLabelName("unbind_project"), LokiLabelProject)
	suite.Equal(LokiLabelName("unbind_environment"), LokiLabelEnvironment)
	suite.Equal(LokiLabelName("unbind_service"), LokiLabelService)
	suite.Equal(LokiLabelName("unbind_deployment"), LokiLabelDeployment)
	suite.Equal(LokiLabelName("unbind_deployment_build"), LokiLabelBuild)
}

func (suite *ModelsTestSuite) TestLokiDirection_Constants() {
	// Test that direction constants are properly defined
	suite.Equal(LokiDirection("forward"), LokiDirectionForward)
	suite.Equal(LokiDirection("backward"), LokiDirectionBackward)
}

func (suite *ModelsTestSuite) TestLokiDirection_Values() {
	direction := LokiDirectionForward
	values := direction.Values()

	suite.Len(values, 2)
	suite.Contains(values, "forward")
	suite.Contains(values, "backward")
}

func (suite *ModelsTestSuite) TestLokiDirection_Schema() {
	direction := LokiDirectionForward
	registry := huma.NewMapRegistry("#/components/schemas/", huma.DefaultSchemaNamer)

	schema := direction.Schema(registry)

	suite.NotNil(schema)
	suite.Equal("#/components/schemas/LokiDirection", schema.Ref)

	// Test that the schema is registered in the registry
	registeredSchema := registry.Map()["LokiDirection"]
	suite.NotNil(registeredSchema)
	suite.Equal("LokiDirection", registeredSchema.Title)
	suite.Len(registeredSchema.Enum, 2)
	suite.Contains(registeredSchema.Enum, "forward")
	suite.Contains(registeredSchema.Enum, "backward")
}

func (suite *ModelsTestSuite) TestLogEventsMessageType_Constants() {
	// Test that message type constants are properly defined
	suite.Equal(LogEventsMessageType("log"), LogEventsMessageTypeLog)
	suite.Equal(LogEventsMessageType("heartbeat"), LogEventsMessageTypeHeartbeat)
	suite.Equal(LogEventsMessageType("error"), LogEventsMessageTypeError)
}

func (suite *ModelsTestSuite) TestLogEventsMessageType_Schema() {
	msgType := LogEventsMessageTypeLog
	registry := huma.NewMapRegistry("#/components/schemas/", huma.DefaultSchemaNamer)

	schema := msgType.Schema(registry)

	suite.NotNil(schema)
	suite.Equal("#/components/schemas/LogEventsMessageType", schema.Ref)

	// Test that the schema is registered in the registry
	registeredSchema := registry.Map()["LogEventsMessageType"]
	suite.NotNil(registeredSchema)
	suite.Equal("LogEventsMessageType", registeredSchema.Title)
	suite.Len(registeredSchema.Enum, 3)
	suite.Contains(registeredSchema.Enum, "log")
	suite.Contains(registeredSchema.Enum, "heartbeat")
	suite.Contains(registeredSchema.Enum, "error")
}

func (suite *ModelsTestSuite) TestLogEventsMessageType_Schema_AlreadyRegistered() {
	msgType := LogEventsMessageTypeLog
	registry := huma.NewMapRegistry("#/components/schemas/", huma.DefaultSchemaNamer)

	// Register schema first time
	schema1 := msgType.Schema(registry)

	// Register schema second time - should return same reference
	schema2 := msgType.Schema(registry)

	suite.Equal(schema1.Ref, schema2.Ref)

	// Should still only have one entry in registry
	suite.Len(registry.Map(), 1)
}

func (suite *ModelsTestSuite) TestLokiDirection_Schema_AlreadyRegistered() {
	direction := LokiDirectionForward
	registry := huma.NewMapRegistry("#/components/schemas/", huma.DefaultSchemaNamer)

	// Register schema first time
	schema1 := direction.Schema(registry)

	// Register schema second time - should return same reference
	schema2 := direction.Schema(registry)

	suite.Equal(schema1.Ref, schema2.Ref)

	// Should still only have one entry in registry
	suite.Len(registry.Map(), 1)
}

func (suite *ModelsTestSuite) TestLokiLogStreamOptions_Struct() {
	opts := LokiLogStreamOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
		RawFilter:  "|= \"error\"",
		Since:      3600000000000, // 1 hour in nanoseconds
		Limit:      100,
	}

	suite.Equal(LokiLabelTeam, opts.Label)
	suite.Equal("team-1", opts.LabelValue)
	suite.Equal("|= \"error\"", opts.RawFilter)
	suite.Equal(int64(3600000000000), int64(opts.Since))
	suite.Equal(100, opts.Limit)
}

func (suite *ModelsTestSuite) TestLokiLogHTTPOptions_Struct() {
	opts := LokiLogHTTPOptions{
		Label:      LokiLabelService,
		LabelValue: "service-1",
		RawFilter:  "|= \"warn\"",
	}

	suite.Equal(LokiLabelService, opts.Label)
	suite.Equal("service-1", opts.LabelValue)
	suite.Equal("|= \"warn\"", opts.RawFilter)
	suite.Nil(opts.Start)
	suite.Nil(opts.End)
	suite.Nil(opts.Since)
	suite.Nil(opts.Time)
	suite.Nil(opts.Limit)
	suite.Nil(opts.Direction)
}

func (suite *ModelsTestSuite) TestLogMetadata_Struct() {
	metadata := LogMetadata{
		ServiceID:     "service-123",
		TeamID:        "team-456",
		ProjectID:     "project-789",
		EnvironmentID: "env-abc",
		DeploymentID:  "deploy-def",
	}

	suite.Equal("service-123", metadata.ServiceID)
	suite.Equal("team-456", metadata.TeamID)
	suite.Equal("project-789", metadata.ProjectID)
	suite.Equal("env-abc", metadata.EnvironmentID)
	suite.Equal("deploy-def", metadata.DeploymentID)
}

func (suite *ModelsTestSuite) TestLogEvent_Struct() {
	event := LogEvent{
		PodName: "pod-1",
		Message: "Test log message",
		Metadata: LogMetadata{
			TeamID: "team-1",
		},
	}

	suite.Equal("pod-1", event.PodName)
	suite.Equal("Test log message", event.Message)
	suite.Equal("team-1", event.Metadata.TeamID)
}

func (suite *ModelsTestSuite) TestLogEvents_Struct() {
	events := LogEvents{
		MessageType: LogEventsMessageTypeLog,
		Logs: []LogEvent{
			{
				PodName: "pod-1",
				Message: "Log 1",
			},
			{
				PodName: "pod-2",
				Message: "Log 2",
			},
		},
	}

	suite.Equal(LogEventsMessageTypeLog, events.MessageType)
	suite.Len(events.Logs, 2)
	suite.Equal("pod-1", events.Logs[0].PodName)
	suite.Equal("pod-2", events.Logs[1].PodName)
	suite.Empty(events.ErrorMessage)
}

func (suite *ModelsTestSuite) TestLogEvents_WithError() {
	events := LogEvents{
		MessageType:  LogEventsMessageTypeError,
		Logs:         []LogEvent{},
		ErrorMessage: "Connection failed",
	}

	suite.Equal(LogEventsMessageTypeError, events.MessageType)
	suite.Len(events.Logs, 0)
	suite.Equal("Connection failed", events.ErrorMessage)
}

func (suite *ModelsTestSuite) TestLokiStreamResponse_Struct() {
	response := LokiStreamResponse{
		Streams: []struct {
			Stream map[string]string `json:"stream"`
			Values [][2]string       `json:"values"`
		}{
			{
				Stream: map[string]string{
					"instance": "pod-1",
					"app":      "test",
				},
				Values: [][2]string{
					{"1609459200000000000", "Log message 1"},
					{"1609459260000000000", "Log message 2"},
				},
			},
		},
	}

	suite.Len(response.Streams, 1)
	suite.Equal("pod-1", response.Streams[0].Stream["instance"])
	suite.Equal("test", response.Streams[0].Stream["app"])
	suite.Len(response.Streams[0].Values, 2)
	suite.Equal("1609459200000000000", response.Streams[0].Values[0][0])
	suite.Equal("Log message 1", response.Streams[0].Values[0][1])
}

func (suite *ModelsTestSuite) TestLokiQueryResponse_Struct() {
	response := LokiQueryResponse{
		Status:    "success",
		ErrorType: "",
		Error:     "",
	}

	suite.Equal("success", response.Status)
	suite.Empty(response.ErrorType)
	suite.Empty(response.Error)
}

func (suite *ModelsTestSuite) TestLokiQueryResponse_WithError() {
	response := LokiQueryResponse{
		Status:    "error",
		ErrorType: "bad_data",
		Error:     "syntax error",
	}

	suite.Equal("error", response.Status)
	suite.Equal("bad_data", response.ErrorType)
	suite.Equal("syntax error", response.Error)
}

func (suite *ModelsTestSuite) TestStream_Struct() {
	stream := Stream{
		Stream: map[string]string{
			"instance": "pod-1",
			"job":      "test-job",
		},
		Values: []StreamValue{
			{"1609459200000000000", "Log message"},
		},
	}

	suite.Equal("pod-1", stream.Stream["instance"])
	suite.Equal("test-job", stream.Stream["job"])
	suite.Len(stream.Values, 1)
	suite.Equal("1609459200000000000", stream.Values[0][0])
	suite.Equal("Log message", stream.Values[0][1])
}

func (suite *ModelsTestSuite) TestMatrixValue_Struct() {
	matrix := MatrixValue{
		Metric: map[string]string{
			"instance": "pod-1",
		},
		Values: []MatrixSample{
			{
				Timestamp: 1609459200000000000,
				Value:     1.5,
			},
		},
	}

	suite.Equal("pod-1", matrix.Metric["instance"])
	suite.Len(matrix.Values, 1)
	suite.Equal(int64(1609459200000000000), matrix.Values[0].Timestamp)
	suite.Equal(1.5, matrix.Values[0].Value)
}

func (suite *ModelsTestSuite) TestVectorValue_Struct() {
	vector := VectorValue{
		Metric: map[string]string{
			"instance": "pod-1",
		},
		Value: VectorSample{
			Timestamp: 1609459200000000000,
			Value:     2.5,
		},
	}

	suite.Equal("pod-1", vector.Metric["instance"])
	suite.Equal(int64(1609459200000000000), vector.Value.Timestamp)
	suite.Equal(2.5, vector.Value.Value)
}

func (suite *ModelsTestSuite) TestStructTags() {
	// Test that struct tags are properly defined for JSON serialization
	logEventType := reflect.TypeOf(LogEvent{})

	// Check PodName field
	podNameField, found := logEventType.FieldByName("PodName")
	suite.True(found)
	suite.Equal("json:\"pod_name\"", string(podNameField.Tag))

	// Check Timestamp field
	timestampField, found := logEventType.FieldByName("Timestamp")
	suite.True(found)
	suite.Equal("json:\"timestamp,omitempty\"", string(timestampField.Tag))

	// Check Message field
	messageField, found := logEventType.FieldByName("Message")
	suite.True(found)
	suite.Equal("json:\"message\"", string(messageField.Tag))

	// Check Metadata field
	metadataField, found := logEventType.FieldByName("Metadata")
	suite.True(found)
	suite.Equal("json:\"metadata\"", string(metadataField.Tag))
}

func (suite *ModelsTestSuite) TestLogMetadataStructTags() {
	logMetadataType := reflect.TypeOf(LogMetadata{})

	// Check ServiceID field
	serviceIDField, found := logMetadataType.FieldByName("ServiceID")
	suite.True(found)
	suite.Equal("json:\"service_id,omitempty\"", string(serviceIDField.Tag))

	// Check TeamID field
	teamIDField, found := logMetadataType.FieldByName("TeamID")
	suite.True(found)
	suite.Equal("json:\"team_id,omitempty\"", string(teamIDField.Tag))

	// Check ProjectID field
	projectIDField, found := logMetadataType.FieldByName("ProjectID")
	suite.True(found)
	suite.Equal("json:\"project_id,omitempty\"", string(projectIDField.Tag))

	// Check EnvironmentID field
	environmentIDField, found := logMetadataType.FieldByName("EnvironmentID")
	suite.True(found)
	suite.Equal("json:\"environment_id,omitempty\"", string(environmentIDField.Tag))

	// Check DeploymentID field
	deploymentIDField, found := logMetadataType.FieldByName("DeploymentID")
	suite.True(found)
	suite.Equal("json:\"deployment_id,omitempty\"", string(deploymentIDField.Tag))
}

func TestModelsTestSuite(t *testing.T) {
	suite.Run(t, new(ModelsTestSuite))
}
