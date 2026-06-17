package loki

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

type HTTPQueryTestSuite struct {
	suite.Suite
	querier    *LokiLogQuerier
	cfg        *config.Config
	testServer *httptest.Server
}

func (suite *HTTPQueryTestSuite) SetupTest() {
	suite.cfg = &config.Config{
		LokiEndpoint: "http://loki.test:3100",
	}

	var err error
	suite.querier, err = NewLokiLogger(suite.cfg)
	suite.Require().NoError(err)
}

func (suite *HTTPQueryTestSuite) TearDownTest() {
	if suite.testServer != nil {
		suite.testServer.Close()
	}
	suite.querier = nil
	suite.cfg = nil
}

func (suite *HTTPQueryTestSuite) setupMockServer(responseBody string, statusCode int) {
	suite.testServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(statusCode)
		w.Write([]byte(responseBody))
	}))

	// Update querier endpoint to use test server
	suite.querier.endpoint = suite.testServer.URL
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_Success_StreamsResult() {
	responseBody := `{
		"status": "success",
		"data": {
			"resultType": "streams",
			"result": [
				{
					"stream": {
						"instance": "pod-1",
						"unbind_team": "team-1",
						"unbind_project": "project-1",
						"unbind_environment": "env-1",
						"unbind_service": "service-1",
						"unbind_deployment": "deployment-1"
					},
					"values": [
						["1609459200000000000", "Log message 1"],
						["1609459260000000000", "Log message 2"]
					]
				}
			]
		}
	}`

	suite.setupMockServer(responseBody, http.StatusOK)

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
		RawFilter:  "|= \"error\"",
		Limit:      utils.ToPtr(100),
		Direction:  utils.ToPtr(LokiDirectionBackward),
	}

	events, err := suite.querier.QueryLokiLogs(context.Background(), opts)

	suite.NoError(err)
	suite.Len(events, 2)

	// Check first event (should be newest first due to backward direction)
	suite.Equal("pod-1", events[0].PodName)
	suite.Equal("Log message 2", events[0].Message)
	suite.Equal("team-1", events[0].Metadata.TeamID)
	suite.Equal("project-1", events[0].Metadata.ProjectID)
	suite.Equal("env-1", events[0].Metadata.EnvironmentID)
	suite.Equal("service-1", events[0].Metadata.ServiceID)
	suite.Equal("deployment-1", events[0].Metadata.DeploymentID)

	// Check second event
	suite.Equal("pod-1", events[1].PodName)
	suite.Equal("Log message 1", events[1].Message)
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_Success_MatrixResult() {
	responseBody := `{
		"status": "success",
		"data": {
			"resultType": "matrix",
			"result": [
				{
					"metric": {
						"instance": "pod-1",
						"unbind_team": "team-1",
						"unbind_project": "project-1",
						"unbind_environment": "env-1",
						"unbind_service": "service-1",
						"unbind_deployment": "deployment-1"
					},
					"values": [
						{
							"timestamp": 1609459200000000000,
							"value": "1.5"
						},
						{
							"timestamp": 1609459260000000000,
							"value": "2.5"
						}
					]
				}
			]
		}
	}`

	suite.setupMockServer(responseBody, http.StatusOK)

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	events, err := suite.querier.QueryLokiLogs(context.Background(), opts)

	suite.NoError(err)
	suite.Len(events, 2)

	// Check first event (matrix results format value as message)
	suite.Equal("pod-1", events[0].PodName)
	suite.Equal("Value: 2.500000", events[0].Message)
	suite.Equal("team-1", events[0].Metadata.TeamID)
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_Success_VectorResult() {
	responseBody := `{
		"status": "success",
		"data": {
			"resultType": "vector",
			"result": [
				{
					"metric": {
						"instance": "pod-1",
						"unbind_team": "team-1",
						"unbind_project": "project-1",
						"unbind_environment": "env-1",
						"unbind_service": "service-1",
						"unbind_deployment": "deployment-1"
					},
					"value": {
						"timestamp": 1609459200000000000,
						"value": "1.5"
					}
				}
			]
		}
	}`

	suite.setupMockServer(responseBody, http.StatusOK)

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	events, err := suite.querier.QueryLokiLogs(context.Background(), opts)

	suite.NoError(err)
	suite.Len(events, 1)

	// Check event (vector results format value as message)
	suite.Equal("pod-1", events[0].PodName)
	suite.Equal("Value: 1.500000", events[0].Message)
	suite.Equal("team-1", events[0].Metadata.TeamID)
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_WithTimeOptions() {
	responseBody := `{
		"status": "success",
		"data": {
			"resultType": "streams",
			"result": []
		}
	}`

	// Create a test server that captures the request
	var capturedQuery string
	suite.testServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedQuery = r.URL.RawQuery
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(responseBody))
	}))
	suite.querier.endpoint = suite.testServer.URL

	now := time.Now()
	start := now.Add(-1 * time.Hour)
	end := now
	since := 30 * time.Minute

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
		Time:       &now,
		Start:      &start,
		End:        &end,
		Since:      &since,
		Limit:      utils.ToPtr(500),
		Direction:  utils.ToPtr(LokiDirectionForward),
	}

	_, err := suite.querier.QueryLokiLogs(context.Background(), opts)

	suite.NoError(err)

	// Verify query parameters
	suite.Contains(capturedQuery, "query=%7Bunbind_team%3D%22team-1%22%7D") // URL encoded {unbind_team="team-1"}
	suite.Contains(capturedQuery, fmt.Sprintf("time=%d", now.Unix()))
	suite.Contains(capturedQuery, fmt.Sprintf("start=%d", start.UnixNano()))
	suite.Contains(capturedQuery, fmt.Sprintf("end=%d", end.UnixNano()))
	suite.Contains(capturedQuery, "limit=500")
	suite.Contains(capturedQuery, "direction=forward")
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_WithSinceNoStart() {
	responseBody := `{
		"status": "success",
		"data": {
			"resultType": "streams",
			"result": []
		}
	}`

	var capturedQuery string
	suite.testServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedQuery = r.URL.RawQuery
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(responseBody))
	}))
	suite.querier.endpoint = suite.testServer.URL

	since := 30 * time.Minute
	end := time.Now()

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
		Since:      &since,
		End:        &end,
	}

	_, err := suite.querier.QueryLokiLogs(context.Background(), opts)

	suite.NoError(err)

	// Should have calculated start time from end - since
	expectedStart := end.Add(-since)
	suite.Contains(capturedQuery, fmt.Sprintf("start=%d", expectedStart.UnixNano()))
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_WithSinceNoEnd() {
	responseBody := `{
		"status": "success",
		"data": {
			"resultType": "streams",
			"result": []
		}
	}`

	var capturedQuery string
	suite.testServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedQuery = r.URL.RawQuery
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(responseBody))
	}))
	suite.querier.endpoint = suite.testServer.URL

	since := 30 * time.Minute

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
		Since:      &since,
	}

	_, err := suite.querier.QueryLokiLogs(context.Background(), opts)

	suite.NoError(err)

	// Should have calculated start time from now - since
	suite.Contains(capturedQuery, "start=")

	// Extract start time and verify it's reasonable
	parts := strings.Split(capturedQuery, "&")
	var startParam string
	for _, part := range parts {
		if strings.HasPrefix(part, "start=") {
			startParam = strings.TrimPrefix(part, "start=")
			break
		}
	}
	suite.NotEmpty(startParam)
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_LimitCapped() {
	responseBody := `{
		"status": "success",
		"data": {
			"resultType": "streams",
			"result": []
		}
	}`

	var capturedQuery string
	suite.testServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedQuery = r.URL.RawQuery
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(responseBody))
	}))
	suite.querier.endpoint = suite.testServer.URL

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
		Limit:      utils.ToPtr(2000), // Above 1000 limit
	}

	_, err := suite.querier.QueryLokiLogs(context.Background(), opts)

	suite.NoError(err)
	suite.Contains(capturedQuery, "limit=1000") // Should be capped at 1000
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_ForwardDirection() {
	responseBody := `{
		"status": "success",
		"data": {
			"resultType": "streams",
			"result": [
				{
					"stream": {
						"instance": "pod-1",
						"unbind_team": "team-1"
					},
					"values": [
						["1609459200000000000", "Log message 1"],
						["1609459260000000000", "Log message 2"]
					]
				}
			]
		}
	}`

	suite.setupMockServer(responseBody, http.StatusOK)

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
		Direction:  utils.ToPtr(LokiDirectionForward),
	}

	events, err := suite.querier.QueryLokiLogs(context.Background(), opts)

	suite.NoError(err)
	suite.Len(events, 2)

	// Forward direction should have oldest first
	suite.Equal("Log message 1", events[0].Message)
	suite.Equal("Log message 2", events[1].Message)
	suite.True(events[0].Timestamp.Before(events[1].Timestamp))
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_BackwardDirection() {
	responseBody := `{
		"status": "success",
		"data": {
			"resultType": "streams",
			"result": [
				{
					"stream": {
						"instance": "pod-1",
						"unbind_team": "team-1"
					},
					"values": [
						["1609459200000000000", "Log message 1"],
						["1609459260000000000", "Log message 2"]
					]
				}
			]
		}
	}`

	suite.setupMockServer(responseBody, http.StatusOK)

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
		Direction:  utils.ToPtr(LokiDirectionBackward),
	}

	events, err := suite.querier.QueryLokiLogs(context.Background(), opts)

	suite.NoError(err)
	suite.Len(events, 2)

	// Backward direction should have newest first
	suite.Equal("Log message 2", events[0].Message)
	suite.Equal("Log message 1", events[1].Message)
	suite.True(events[0].Timestamp.After(events[1].Timestamp))
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_WithBuildLabel() {
	responseBody := `{
		"status": "success",
		"data": {
			"resultType": "streams",
			"result": [
				{
					"stream": {
						"instance": "pod-1",
						"unbind_team": "team-1",
						"unbind_deployment_build": "build-123"
					},
					"values": [
						["1609459200000000000", "Log message 1"]
					]
				}
			]
		}
	}`

	suite.setupMockServer(responseBody, http.StatusOK)

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	events, err := suite.querier.QueryLokiLogs(context.Background(), opts)

	suite.NoError(err)
	suite.Len(events, 1)

	// Should use build label as deployment ID when deployment label is not present
	suite.Equal("build-123", events[0].Metadata.DeploymentID)
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_ErrorResponse() {
	responseBody := `{
		"status": "error",
		"errorType": "bad_data",
		"error": "parse error at line 1, col 15: syntax error: unexpected IDENTIFIER"
	}`

	suite.setupMockServer(responseBody, http.StatusOK)

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	_, err := suite.querier.QueryLokiLogs(context.Background(), opts)

	suite.Error(err)
	suite.Contains(err.Error(), "loki query returned error")
	suite.Contains(err.Error(), "bad_data")
	suite.Contains(err.Error(), "parse error")
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_HTTPError() {
	suite.setupMockServer("Internal Server Error", http.StatusInternalServerError)

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	_, err := suite.querier.QueryLokiLogs(context.Background(), opts)

	suite.Error(err)
	suite.Contains(err.Error(), "loki query failed with status 500")
	suite.Contains(err.Error(), "Internal Server Error")
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_InvalidJSON() {
	suite.setupMockServer("invalid json", http.StatusOK)

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	_, err := suite.querier.QueryLokiLogs(context.Background(), opts)

	suite.Error(err)
	suite.Contains(err.Error(), "failed to unmarshal Loki response")
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_UnsupportedResultType() {
	responseBody := `{
		"status": "success",
		"data": {
			"resultType": "unsupported",
			"result": []
		}
	}`

	suite.setupMockServer(responseBody, http.StatusOK)

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	_, err := suite.querier.QueryLokiLogs(context.Background(), opts)

	suite.Error(err)
	suite.Contains(err.Error(), "unsupported result type: unsupported")
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_InvalidStreamFormat() {
	responseBody := `{
		"status": "success",
		"data": {
			"resultType": "streams",
			"result": [
				{
					"stream": {
						"instance": "pod-1"
					},
					"values": [
						["1609459200000000000"]
					]
				}
			]
		}
	}`

	suite.setupMockServer(responseBody, http.StatusOK)

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	events, err := suite.querier.QueryLokiLogs(context.Background(), opts)

	// Should not error, but should skip invalid entries
	suite.NoError(err)
	suite.Len(events, 0)
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_InvalidTimestamp() {
	responseBody := `{
		"status": "success",
		"data": {
			"resultType": "streams",
			"result": [
				{
					"stream": {
						"instance": "pod-1"
					},
					"values": [
						["invalid_timestamp", "Log message"]
					]
				}
			]
		}
	}`

	suite.setupMockServer(responseBody, http.StatusOK)

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	events, err := suite.querier.QueryLokiLogs(context.Background(), opts)

	// Should not error, but should use current time as fallback
	suite.NoError(err)
	suite.Len(events, 1)
	suite.Equal("Log message", events[0].Message)
	// Timestamp should be close to now (within last minute)
	suite.WithinDuration(time.Now(), events[0].Timestamp, time.Minute)
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_ContextCanceled() {
	// Create a server that delays response
	suite.testServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "success", "data": {"resultType": "streams", "result": []}}`))
	}))
	suite.querier.endpoint = suite.testServer.URL

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	_, err := suite.querier.QueryLokiLogs(ctx, opts)

	suite.Error(err)
	suite.Contains(err.Error(), "failed to execute Loki query")
}

func (suite *HTTPQueryTestSuite) TestQueryLokiLogs_InvalidURL() {
	// Make endpoint invalid
	suite.querier.endpoint = "://invalid-url"

	opts := LokiLogHTTPOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	_, err := suite.querier.QueryLokiLogs(context.Background(), opts)

	suite.Error(err)
	suite.Contains(err.Error(), "unable to parse loki query URL")
}

func (suite *HTTPQueryTestSuite) TestParseStreamsResult_EmptyInstance() {
	streams := []Stream{
		{
			Stream: map[string]string{
				"unbind_team": "team-1",
			},
			Values: []StreamValue{
				{"1609459200000000000", "Log message"},
			},
		},
	}

	events := parseStreamsResult(streams)

	suite.Len(events, 1)
	suite.Equal("", events[0].PodName) // Empty instance should result in empty pod name
	suite.Equal("team-1", events[0].Metadata.TeamID)
}

func (suite *HTTPQueryTestSuite) TestParseMatrixResult_EmptyMetrics() {
	matrixValues := []MatrixValue{
		{
			Metric: map[string]string{},
			Values: []MatrixSample{
				{
					Timestamp: 1609459200000000000,
					Value:     1.5,
				},
			},
		},
	}

	events := parseMatrixResult(matrixValues)

	suite.Len(events, 1)
	suite.Equal("", events[0].PodName)
	suite.Equal("", events[0].Metadata.TeamID)
	suite.Equal("Value: 1.500000", events[0].Message)
}

func (suite *HTTPQueryTestSuite) TestParseVectorResult_EmptyMetrics() {
	vectorValues := []VectorValue{
		{
			Metric: map[string]string{},
			Value: VectorSample{
				Timestamp: 1609459200000000000,
				Value:     1.5,
			},
		},
	}

	events := parseVectorResult(vectorValues)

	suite.Len(events, 1)
	suite.Equal("", events[0].PodName)
	suite.Equal("", events[0].Metadata.TeamID)
	suite.Equal("Value: 1.500000", events[0].Message)
}

func TestHTTPQueryTestSuite(t *testing.T) {
	suite.Run(t, new(HTTPQueryTestSuite))
}
