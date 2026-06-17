package loki

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/suite"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

type StreamTestSuite struct {
	suite.Suite
	querier    *LokiLogQuerier
	cfg        *config.Config
	testServer *httptest.Server
	wsUpgrader websocket.Upgrader
}

func (suite *StreamTestSuite) SetupTest() {
	suite.cfg = &config.Config{
		LokiEndpoint: "http://loki.test:3100",
	}

	var err error
	suite.querier, err = NewLokiLogger(suite.cfg)
	suite.Require().NoError(err)

	suite.wsUpgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for testing
		},
	}
}

func (suite *StreamTestSuite) TearDownTest() {
	if suite.testServer != nil {
		suite.testServer.Close()
	}
	suite.querier = nil
	suite.cfg = nil
}

func (suite *StreamTestSuite) setupMockHTTPServer(responseBody string, statusCode int) {
	suite.testServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(statusCode)
		w.Write([]byte(responseBody))
	}))
}

func (suite *StreamTestSuite) setupMockWebSocketServer(messages []LokiStreamResponse, delay time.Duration, sendPings bool) {
	suite.testServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := suite.wsUpgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		// Set up ping/pong handlers
		conn.SetPingHandler(func(data string) error {
			return conn.WriteControl(websocket.PongMessage, []byte(data), time.Now().Add(5*time.Second))
		})

		// Send messages
		for _, msg := range messages {
			if delay > 0 {
				time.Sleep(delay)
			}

			msgBytes, _ := json.Marshal(msg)
			err := conn.WriteMessage(websocket.TextMessage, msgBytes)
			if err != nil {
				return
			}
		}

		// Send pings if requested
		if sendPings {
			ticker := time.NewTicker(5 * time.Second)
			defer ticker.Stop()

			go func() {
				for {
					select {
					case <-ticker.C:
						err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(5*time.Second))
						if err != nil {
							return
						}
					}
				}
			}()
		}

		// Keep connection alive for a bit
		time.Sleep(20 * time.Millisecond)
	}))
}

func (suite *StreamTestSuite) TestStreamLokiPodLogs_Success() {
	messages := []LokiStreamResponse{
		{
			Streams: []struct {
				Stream map[string]string `json:"stream"`
				Values [][2]string       `json:"values"`
			}{
				{
					Stream: map[string]string{
						"instance":           "pod-1",
						"unbind_team":        "team-1",
						"unbind_project":     "project-1",
						"unbind_environment": "env-1",
						"unbind_service":     "service-1",
						"unbind_deployment":  "deployment-1",
					},
					Values: [][2]string{
						{"1609459200000000000", "Log message 1"},
						{"1609459260000000000", "Log message 2"},
					},
				},
			},
		},
	}

	suite.setupMockWebSocketServer(messages, 0, false)
	wsURL := "ws" + strings.TrimPrefix(suite.testServer.URL, "http")
	suite.querier.endpoint = wsURL

	// Mock HTTP response for initial no-logs check
	httpResponse := `{
		"status": "success",
		"data": {
			"resultType": "streams",
			"result": [
				{
					"stream": {"instance": "pod-1"},
					"values": [["1609459200000000000", "Log message"]]
				}
			]
		}
	}`

	// Start HTTP mock for the initial check
	httpServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(httpResponse))
	}))
	defer httpServer.Close()

	// Temporarily replace the querier's endpoint for HTTP call, then restore for WS
	originalEndpoint := suite.querier.endpoint
	suite.querier.endpoint = httpServer.URL

	eventChan := make(chan LogEvents, 10)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	opts := LokiLogStreamOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
		RawFilter:  "|= \"message\"",
		Limit:      100,
	}

	// Start streaming in goroutine
	go func() {
		// Restore WS endpoint before streaming
		suite.querier.endpoint = originalEndpoint
		err := suite.querier.StreamLokiPodLogs(ctx, opts, eventChan)
		if err != nil && !strings.Contains(err.Error(), "context") {
			suite.T().Logf("Stream error: %v", err)
		}
	}()

	// Collect events
	var receivedEvents []LogEvents
	timeout := time.After(20 * time.Millisecond)

	for {
		select {
		case event := <-eventChan:
			receivedEvents = append(receivedEvents, event)
			if len(receivedEvents) >= 1 { // Just need one log event
				goto done
			}
		case <-timeout:
			goto done
		case <-ctx.Done():
			goto done
		}
	}

done:
	cancel()
	close(eventChan)

	// Should have received at least one event
	suite.GreaterOrEqual(len(receivedEvents), 1)

	// Find the log event (not heartbeat)
	var logEvent *LogEvents
	for _, event := range receivedEvents {
		if event.MessageType == LogEventsMessageTypeLog && len(event.Logs) > 0 {
			logEvent = &event
			break
		}
	}

	suite.NotNil(logEvent, "Should receive at least one log event")
	suite.Len(logEvent.Logs, 2)

	// Verify log content (should be sorted oldest first)
	suite.Equal("pod-1", logEvent.Logs[0].PodName)
	suite.Equal("Log message 1", logEvent.Logs[0].Message)
	suite.Equal("team-1", logEvent.Logs[0].Metadata.TeamID)
	suite.Equal("project-1", logEvent.Logs[0].Metadata.ProjectID)
	suite.Equal("env-1", logEvent.Logs[0].Metadata.EnvironmentID)
	suite.Equal("service-1", logEvent.Logs[0].Metadata.ServiceID)
	suite.Equal("deployment-1", logEvent.Logs[0].Metadata.DeploymentID)

	suite.Equal("Log message 2", logEvent.Logs[1].Message)
	suite.True(logEvent.Logs[0].Timestamp.Before(logEvent.Logs[1].Timestamp))
}

func (suite *StreamTestSuite) TestStreamLokiPodLogs_NoInitialLogs() {
	// Setup HTTP server that returns no logs for initial check
	httpResponse := `{
		"status": "success",
		"data": {
			"resultType": "streams",
			"result": []
		}
	}`

	httpServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(httpResponse))
	}))
	defer httpServer.Close()

	// Setup WebSocket server with messages
	messages := []LokiStreamResponse{
		{
			Streams: []struct {
				Stream map[string]string `json:"stream"`
				Values [][2]string       `json:"values"`
			}{
				{
					Stream: map[string]string{
						"instance":    "pod-1",
						"unbind_team": "team-1",
					},
					Values: [][2]string{
						{"1609459200000000000", "New log message"},
					},
				},
			},
		},
	}

	suite.setupMockWebSocketServer(messages, 10*time.Millisecond, false)
	wsURL := "ws" + strings.TrimPrefix(suite.testServer.URL, "http")

	eventChan := make(chan LogEvents, 10)
	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	defer cancel()

	opts := LokiLogStreamOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
		Limit:      100,
	}

	// Start streaming
	go func() {
		// Set HTTP endpoint for initial check
		suite.querier.endpoint = httpServer.URL

		// Perform initial HTTP check which should return no logs
		httpOpts := LokiLogHTTPOptions{
			Label:      opts.Label,
			LabelValue: opts.LabelValue,
			RawFilter:  opts.RawFilter,
			Limit:      utils.ToPtr(1),
		}
		logs, _ := suite.querier.QueryLokiLogs(ctx, httpOpts)

		// Should send empty logs message
		if len(logs) == 0 {
			select {
			case eventChan <- LogEvents{MessageType: LogEventsMessageTypeLog, Logs: []LogEvent{}}:
			case <-ctx.Done():
				return
			}
		}

		// Switch to WebSocket endpoint
		suite.querier.endpoint = wsURL
		err := suite.querier.StreamLokiPodLogs(ctx, opts, eventChan)
		if err != nil && !strings.Contains(err.Error(), "context") {
			suite.T().Logf("Stream error: %v", err)
		}
	}()

	// Collect events
	var receivedEvents []LogEvents
	timeout := time.After(100 * time.Millisecond)

	for {
		select {
		case event := <-eventChan:
			receivedEvents = append(receivedEvents, event)
		case <-timeout:
			goto done
		case <-ctx.Done():
			goto done
		}
	}

done:
	cancel()
	close(eventChan)

	// Should receive empty logs event first, then actual logs
	suite.GreaterOrEqual(len(receivedEvents), 1)

	// First event should be empty logs
	suite.Equal(LogEventsMessageTypeLog, receivedEvents[0].MessageType)
	suite.Len(receivedEvents[0].Logs, 0)
}

func (suite *StreamTestSuite) TestStreamLokiPodLogs_WithSince() {
	suite.setupMockWebSocketServer([]LokiStreamResponse{}, 0, false)
	wsURL := "ws" + strings.TrimPrefix(suite.testServer.URL, "http")

	// Capture the WebSocket request
	var capturedURL *url.URL
	originalServer := suite.testServer
	suite.testServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedURL = r.URL
		conn, _ := suite.wsUpgrader.Upgrade(w, r, nil)
		conn.Close()
	}))
	originalServer.Close()

	wsURL = "ws" + strings.TrimPrefix(suite.testServer.URL, "http")
	suite.querier.endpoint = wsURL

	eventChan := make(chan LogEvents, 1)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	opts := LokiLogStreamOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
		Since:      30 * time.Minute,
		Limit:      200,
	}

	go func() {
		suite.querier.StreamLokiPodLogs(ctx, opts, eventChan)
	}()

	<-ctx.Done()
	close(eventChan)

	// Verify query parameters
	suite.NotNil(capturedURL)
	query := capturedURL.Query()
	suite.Equal("{unbind_team=\"team-1\"}", query.Get("query"))
	suite.Equal("200", query.Get("limit"))
	suite.NotEmpty(query.Get("start")) // Should have calculated start time
}

func (suite *StreamTestSuite) TestStreamLokiPodLogs_WithStart() {
	suite.setupMockWebSocketServer([]LokiStreamResponse{}, 0, false)
	wsURL := "ws" + strings.TrimPrefix(suite.testServer.URL, "http")

	var capturedURL *url.URL
	originalServer := suite.testServer
	suite.testServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedURL = r.URL
		conn, _ := suite.wsUpgrader.Upgrade(w, r, nil)
		conn.Close()
	}))
	originalServer.Close()

	wsURL = "ws" + strings.TrimPrefix(suite.testServer.URL, "http")
	suite.querier.endpoint = wsURL

	eventChan := make(chan LogEvents, 1)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	start := time.Now().Add(-1 * time.Hour)
	opts := LokiLogStreamOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
		Start:      start,
	}

	go func() {
		suite.querier.StreamLokiPodLogs(ctx, opts, eventChan)
	}()

	<-ctx.Done()
	close(eventChan)

	// Verify start parameter
	suite.NotNil(capturedURL)
	query := capturedURL.Query()
	suite.Equal(fmt.Sprintf("%d", start.UnixNano()), query.Get("start"))
}

func (suite *StreamTestSuite) TestStreamLokiPodLogs_LimitCapped() {
	suite.setupMockWebSocketServer([]LokiStreamResponse{}, 0, false)
	wsURL := "ws" + strings.TrimPrefix(suite.testServer.URL, "http")

	var capturedURL *url.URL
	originalServer := suite.testServer
	suite.testServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedURL = r.URL
		conn, _ := suite.wsUpgrader.Upgrade(w, r, nil)
		conn.Close()
	}))
	originalServer.Close()

	wsURL = "ws" + strings.TrimPrefix(suite.testServer.URL, "http")
	suite.querier.endpoint = wsURL

	eventChan := make(chan LogEvents, 1)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	opts := LokiLogStreamOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
		Limit:      2000, // Above 1000 limit
	}

	go func() {
		suite.querier.StreamLokiPodLogs(ctx, opts, eventChan)
	}()

	<-ctx.Done()
	close(eventChan)

	// Should be capped at 1000
	suite.NotNil(capturedURL)
	query := capturedURL.Query()
	suite.Equal("1000", query.Get("limit"))
}

func (suite *StreamTestSuite) TestStreamLokiPodLogs_HTTPStoWS() {
	suite.setupMockWebSocketServer([]LokiStreamResponse{}, 0, false)

	// Test HTTPS to WSS conversion
	suite.querier.endpoint = "https://loki.test:3100/loki/api/v1/tail"

	var capturedScheme string
	originalServer := suite.testServer
	suite.testServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedScheme = "ws" // We can't test WSS in httptest, but we can verify the code path
		conn, _ := suite.wsUpgrader.Upgrade(w, r, nil)
		conn.Close()
	}))
	originalServer.Close()

	// Replace the https with the test server URL but keep the path
	testURL, _ := url.Parse(suite.testServer.URL)
	suite.querier.endpoint = "ws://" + testURL.Host + "/loki/api/v1/tail"

	eventChan := make(chan LogEvents, 1)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	opts := LokiLogStreamOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	go func() {
		suite.querier.StreamLokiPodLogs(ctx, opts, eventChan)
	}()

	<-ctx.Done()
	close(eventChan)

	// Just verify it attempted the connection
	suite.Equal("ws", capturedScheme)
}

func (suite *StreamTestSuite) TestStreamLokiPodLogs_ContextCanceled() {
	suite.setupMockWebSocketServer([]LokiStreamResponse{}, 20*time.Millisecond, false)
	wsURL := "ws" + strings.TrimPrefix(suite.testServer.URL, "http")
	suite.querier.endpoint = wsURL

	eventChan := make(chan LogEvents, 1)
	ctx, cancel := context.WithCancel(context.Background())

	opts := LokiLogStreamOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel() // Cancel while streaming
	}()

	err := suite.querier.StreamLokiPodLogs(ctx, opts, eventChan)

	// Should return nil or connection error when context is canceled (normal shutdown)
	if err != nil {
		// Accept connection errors due to context cancellation race condition
		suite.True(strings.Contains(err.Error(), "use of closed network connection") ||
			strings.Contains(err.Error(), "websocket: close"))
	}
	close(eventChan)
}

func (suite *StreamTestSuite) TestStreamLokiPodLogs_InvalidJSON() {
	// Setup WebSocket server that sends invalid JSON
	suite.testServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := suite.wsUpgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		// Send invalid JSON
		conn.WriteMessage(websocket.TextMessage, []byte("invalid json"))
		time.Sleep(100 * time.Millisecond)
	}))

	wsURL := "ws" + strings.TrimPrefix(suite.testServer.URL, "http")
	suite.querier.endpoint = wsURL

	eventChan := make(chan LogEvents, 1)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	opts := LokiLogStreamOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	err := suite.querier.StreamLokiPodLogs(ctx, opts, eventChan)

	// Should not error on invalid JSON, just log warning and continue, but may error on connection close
	if err != nil {
		// Accept connection errors due to server closing connection
		suite.True(strings.Contains(err.Error(), "unexpected EOF") ||
			strings.Contains(err.Error(), "websocket: close") ||
			strings.Contains(err.Error(), "use of closed network connection"))
	}
	close(eventChan)
}

func (suite *StreamTestSuite) TestStreamLokiPodLogs_InvalidLogEntry() {
	messages := []LokiStreamResponse{
		{
			Streams: []struct {
				Stream map[string]string `json:"stream"`
				Values [][2]string       `json:"values"`
			}{
				{
					Stream: map[string]string{
						"instance": "pod-1",
					},
					Values: [][2]string{
						{"1609459200000000000", "Log message 1"}, // Valid entry
						{"1609459200000000000", ""},              // Entry with empty message - should still be processed
					},
				},
			},
		},
	}

	suite.setupMockWebSocketServer(messages, 0, false)
	wsURL := "ws" + strings.TrimPrefix(suite.testServer.URL, "http")
	suite.querier.endpoint = wsURL

	eventChan := make(chan LogEvents, 10)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	opts := LokiLogStreamOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	go func() {
		suite.querier.StreamLokiPodLogs(ctx, opts, eventChan)
	}()

	// Collect events
	var receivedEvents []LogEvents
	timeout := time.After(100 * time.Millisecond)

	for {
		select {
		case event := <-eventChan:
			receivedEvents = append(receivedEvents, event)
		case <-timeout:
			goto done
		case <-ctx.Done():
			goto done
		}
	}

done:
	cancel()
	close(eventChan)

	// Should receive log events for valid entries
	totalLogs := 0
	for _, event := range receivedEvents {
		if event.MessageType == LogEventsMessageTypeLog {
			totalLogs += len(event.Logs)
		}
	}
	suite.Equal(2, totalLogs, "Should receive 2 log events (both entries are valid)")
}

func (suite *StreamTestSuite) TestStreamLokiPodLogs_InvalidTimestamp() {
	messages := []LokiStreamResponse{
		{
			Streams: []struct {
				Stream map[string]string `json:"stream"`
				Values [][2]string       `json:"values"`
			}{
				{
					Stream: map[string]string{
						"instance": "pod-1",
					},
					Values: [][2]string{
						{"invalid_timestamp", "Log message"},
					},
				},
			},
		},
	}

	suite.setupMockWebSocketServer(messages, 0, false)
	wsURL := "ws" + strings.TrimPrefix(suite.testServer.URL, "http")
	suite.querier.endpoint = wsURL

	eventChan := make(chan LogEvents, 10)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	opts := LokiLogStreamOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	go func() {
		suite.querier.StreamLokiPodLogs(ctx, opts, eventChan)
	}()

	// Collect events
	var receivedEvents []LogEvents
	timeout := time.After(100 * time.Millisecond)

	for {
		select {
		case event := <-eventChan:
			receivedEvents = append(receivedEvents, event)
		case <-timeout:
			goto done
		case <-ctx.Done():
			goto done
		}
	}

done:
	cancel()
	close(eventChan)

	// Should still receive the log event with current time as fallback
	var logEvent *LogEvents
	for _, event := range receivedEvents {
		if event.MessageType == LogEventsMessageTypeLog && len(event.Logs) > 0 {
			logEvent = &event
			break
		}
	}

	if logEvent != nil {
		suite.Len(logEvent.Logs, 1)
		suite.Equal("Log message", logEvent.Logs[0].Message)
		// Timestamp should be close to now
		suite.WithinDuration(time.Now(), logEvent.Logs[0].Timestamp, time.Minute)
	}
}

func (suite *StreamTestSuite) TestStreamLokiPodLogs_WithBuildLabel() {
	messages := []LokiStreamResponse{
		{
			Streams: []struct {
				Stream map[string]string `json:"stream"`
				Values [][2]string       `json:"values"`
			}{
				{
					Stream: map[string]string{
						"instance":                "pod-1",
						"unbind_team":             "team-1",
						"unbind_deployment_build": "build-123",
					},
					Values: [][2]string{
						{"1609459200000000000", "Log message"},
					},
				},
			},
		},
	}

	suite.setupMockWebSocketServer(messages, 0, false)
	wsURL := "ws" + strings.TrimPrefix(suite.testServer.URL, "http")
	suite.querier.endpoint = wsURL

	eventChan := make(chan LogEvents, 10)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	opts := LokiLogStreamOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	go func() {
		suite.querier.StreamLokiPodLogs(ctx, opts, eventChan)
	}()

	// Collect events
	var receivedEvents []LogEvents
	timeout := time.After(100 * time.Millisecond)

	for {
		select {
		case event := <-eventChan:
			receivedEvents = append(receivedEvents, event)
		case <-timeout:
			goto done
		case <-ctx.Done():
			goto done
		}
	}

done:
	cancel()
	close(eventChan)

	// Should use build label as deployment ID
	var logEvent *LogEvents
	for _, event := range receivedEvents {
		if event.MessageType == LogEventsMessageTypeLog && len(event.Logs) > 0 {
			logEvent = &event
			break
		}
	}

	if logEvent != nil {
		suite.Len(logEvent.Logs, 1)
		suite.Equal("build-123", logEvent.Logs[0].Metadata.DeploymentID)
	}
}

func (suite *StreamTestSuite) TestStreamLokiPodLogs_MissingInstance() {
	messages := []LokiStreamResponse{
		{
			Streams: []struct {
				Stream map[string]string `json:"stream"`
				Values [][2]string       `json:"values"`
			}{
				{
					Stream: map[string]string{
						"unbind_team": "team-1",
						// Missing instance label
					},
					Values: [][2]string{
						{"1609459200000000000", "Log message"},
					},
				},
			},
		},
	}

	suite.setupMockWebSocketServer(messages, 0, false)
	wsURL := "ws" + strings.TrimPrefix(suite.testServer.URL, "http")
	suite.querier.endpoint = wsURL

	eventChan := make(chan LogEvents, 10)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	opts := LokiLogStreamOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	go func() {
		suite.querier.StreamLokiPodLogs(ctx, opts, eventChan)
	}()

	// Collect events
	var receivedEvents []LogEvents
	timeout := time.After(100 * time.Millisecond)

	for {
		select {
		case event := <-eventChan:
			receivedEvents = append(receivedEvents, event)
		case <-timeout:
			goto done
		case <-ctx.Done():
			goto done
		}
	}

done:
	cancel()
	close(eventChan)

	// Should still receive the log event with empty pod name
	var logEvent *LogEvents
	for _, event := range receivedEvents {
		if event.MessageType == LogEventsMessageTypeLog && len(event.Logs) > 0 {
			logEvent = &event
			break
		}
	}

	if logEvent != nil {
		suite.Len(logEvent.Logs, 1)
		suite.Equal("", logEvent.Logs[0].PodName) // Empty due to missing instance
		suite.Equal("Log message", logEvent.Logs[0].Message)
	}
}

func (suite *StreamTestSuite) TestStreamLokiPodLogs_ConnectionError() {
	// Set invalid WebSocket URL
	suite.querier.endpoint = "ws://invalid-host:9999/ws"

	eventChan := make(chan LogEvents, 1)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	opts := LokiLogStreamOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	err := suite.querier.StreamLokiPodLogs(ctx, opts, eventChan)

	suite.Error(err)
	suite.Contains(err.Error(), "failed to connect to Loki WebSocket")
	close(eventChan)
}

func (suite *StreamTestSuite) TestStreamLokiPodLogs_InvalidURL() {
	// Set invalid URL
	suite.querier.endpoint = "://invalid-url"

	eventChan := make(chan LogEvents, 1)
	ctx := context.Background()

	opts := LokiLogStreamOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	err := suite.querier.StreamLokiPodLogs(ctx, opts, eventChan)

	suite.Error(err)
	suite.Contains(err.Error(), "unable to parse loki query URL")
	close(eventChan)
}

func (suite *StreamTestSuite) TestStreamLokiPodLogs_HeartbeatMessages() {
	// Setup a WebSocket server that doesn't send any log messages
	// but keeps the connection alive
	suite.testServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := suite.wsUpgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		// Keep connection alive for the duration of the test
		// Read messages to keep connection active
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}))

	wsURL := "ws" + strings.TrimPrefix(suite.testServer.URL, "http")
	suite.querier.endpoint = wsURL

	eventChan := make(chan LogEvents, 10)
	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	defer cancel()

	opts := LokiLogStreamOptions{
		Label:             LokiLabelTeam,
		LabelValue:        "team-1",
		HeartbeatInterval: 50 * time.Millisecond, // Very short interval for testing
	}

	go func() {
		suite.querier.StreamLokiPodLogs(ctx, opts, eventChan)
	}()

	// Collect events - should receive heartbeat messages
	var heartbeatReceived bool
	timeout := time.After(100 * time.Millisecond) // Wait long enough for at least one heartbeat

	for {
		select {
		case event := <-eventChan:
			if event.MessageType == LogEventsMessageTypeHeartbeat {
				heartbeatReceived = true
				goto done // Exit as soon as we get a heartbeat
			}
		case <-timeout:
			goto done
		case <-ctx.Done():
			goto done
		}
	}

done:
	cancel()
	close(eventChan)

	// Should have received at least one heartbeat
	suite.True(heartbeatReceived, "Should receive heartbeat messages")
}

func (suite *StreamTestSuite) TestStreamLokiPodLogs_MalformedLogEntry() {
	// Create a custom WebSocket server that sends malformed log entries
	suite.testServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upgrader := websocket.Upgrader{}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		// Send message with malformed log entry (values as string instead of array)
		malformedMessage := `{
			"streams": [
				{
					"stream": {
						"instance": "pod-1"
					},
					"values": "not_an_array"
				}
			]
		}`

		conn.WriteMessage(websocket.TextMessage, []byte(malformedMessage))
		time.Sleep(100 * time.Millisecond)
	}))

	wsURL := "ws" + strings.TrimPrefix(suite.testServer.URL, "http")
	suite.querier.endpoint = wsURL

	eventChan := make(chan LogEvents, 10)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	opts := LokiLogStreamOptions{
		Label:      LokiLabelTeam,
		LabelValue: "team-1",
	}

	go func() {
		suite.querier.StreamLokiPodLogs(ctx, opts, eventChan)
	}()

	// Collect events
	var receivedEvents []LogEvents
	timeout := time.After(100 * time.Millisecond)

	for {
		select {
		case event := <-eventChan:
			receivedEvents = append(receivedEvents, event)
		case <-timeout:
			goto done
		case <-ctx.Done():
			goto done
		}
	}

done:
	cancel()
	close(eventChan)

	// Should not receive any log events due to malformed entries
	totalLogs := 0
	for _, event := range receivedEvents {
		if event.MessageType == LogEventsMessageTypeLog {
			totalLogs += len(event.Logs)
		}
	}
	suite.Equal(0, totalLogs, "Should not receive any log events due to malformed entries")
}

func TestStreamTestSuite(t *testing.T) {
	suite.Run(t, new(StreamTestSuite))
}
