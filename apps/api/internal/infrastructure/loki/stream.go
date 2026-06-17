package loki

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// StreamLokiPodLogs streams logs from Loki tail API using WebSocket for multiple pods using a single connection
func (self *LokiLogQuerier) StreamLokiPodLogs(
	ctx context.Context,
	opts LokiLogStreamOptions,
	eventChan chan<- LogEvents,
) error {
	queryStr := fmt.Sprintf("{%s=\"%s\"}", opts.Label, opts.LabelValue)

	// Add extra filters
	if opts.RawFilter != "" {
		queryStr = fmt.Sprintf("%s %s", queryStr, opts.RawFilter)
	}

	// Build the request URL with parameters
	reqURL, err := url.Parse(self.endpoint)
	if err != nil {
		return fmt.Errorf("unable to parse loki query URL: %v", err)
	}

	// Change protocol from http to ws
	switch reqURL.Scheme {
	case "http":
		reqURL.Scheme = "ws"
	case "https":
		reqURL.Scheme = "wss"
	}

	q := reqURL.Query()
	q.Set("query", queryStr)

	// Set time range
	if !opts.Start.IsZero() {
		q.Set("start", strconv.FormatInt(opts.Start.UnixNano(), 10))
	} else if opts.Since > 0 {
		startTime := time.Now().Add(-opts.Since)
		q.Set("start", strconv.FormatInt(startTime.UnixNano(), 10))
	}

	// Set limit
	if opts.Limit > 0 {
		if opts.Limit > 1000 {
			opts.Limit = 1000
		}
		q.Set("limit", strconv.Itoa(opts.Limit))
	}

	reqURL.RawQuery = q.Encode()

	log.Infof("Streaming logs with query: %s, URL: %s", queryStr, reqURL.String())

	// First do no logs check
	// First, check if there are any logs by performing a quick HTTP query
	httpOpts := LokiLogHTTPOptions{
		Label:      opts.Label,
		LabelValue: opts.LabelValue,
		RawFilter:  opts.RawFilter,
		Limit:      utils.ToPtr(1),
	}
	if !opts.Start.IsZero() {
		httpOpts.Start = &opts.Start
	} else if opts.Since > 0 {
		httpOpts.Since = &opts.Since
	}

	// If we get nothing then we can send NoLogs message immediately
	logs, err := self.QueryLokiLogs(ctx, httpOpts)
	if err != nil {
		log.Warnf("Failed to check for logs existence: %v", err)
		// Continue anyway - we'll just use WebSocket
	} else if len(logs) == 0 {
		// No logs found, send NoLogs message immediately
		log.Info("No logs found for query, sending NoLogs message")
		select {
		case eventChan <- LogEvents{MessageType: LogEventsMessageTypeLog, Logs: []LogEvent{}}:
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	// Create websocket connection with timeout
	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = 15 * time.Second // Set a reasonable timeout

	wsConn, resp, err := dialer.DialContext(ctx, reqURL.String(), nil)
	if err != nil {
		if resp != nil {
			return fmt.Errorf("failed to connect to Loki WebSocket: %v, status: %d", err, resp.StatusCode)
		}
		return fmt.Errorf("failed to connect to Loki WebSocket: %v", err)
	}
	defer wsConn.Close()

	// Set the ping handler to respond with pongs to keep the connection alive
	wsConn.SetPingHandler(func(data string) error {
		err := wsConn.WriteControl(websocket.PongMessage, []byte(data), time.Now().Add(5*time.Second))
		if err != nil {
			log.Warnf("Failed to send pong: %v", err)
		}
		return nil
	})

	// Set the pong handler to reset the read deadline when a pong is received
	wsConn.SetPongHandler(func(string) error {
		return wsConn.SetReadDeadline(time.Now().Add(60 * time.Second))
	})

	// Initial read deadline - this will be extended by pongs and successful reads
	_ = wsConn.SetReadDeadline(time.Now().Add(60 * time.Second))

	// Setup context cancellation
	done := make(chan struct{})
	go func() {
		<-ctx.Done()
		log.Info("Context done, closing WebSocket connection")
		// Close the connection gracefully when context is done
		_ = wsConn.WriteControl(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""),
			time.Now().Add(5*time.Second))
		wsConn.Close()
		close(done)
	}()

	// Initialize a ping ticker to send pings periodically
	pingTicker := time.NewTicker(15 * time.Second)
	defer pingTicker.Stop()

	// Initialize a heartbeat ticker to send empty messages periodically to client
	heartbeatInterval := opts.HeartbeatInterval
	if heartbeatInterval <= 0 {
		heartbeatInterval = 10 * time.Second // Default to 10 seconds
	}
	heartbeatTicker := time.NewTicker(heartbeatInterval)
	defer heartbeatTicker.Stop()

	// Main loop for handling the WebSocket connection
	go func() {
		for {
			select {
			case <-done:
				return
			case <-pingTicker.C:
				// Send ping to server to keep connection alive
				err := wsConn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(5*time.Second))
				if err != nil {
					log.Warnf("Failed to send ping: %v", err)
				}
			case <-heartbeatTicker.C:
				// Send heartbeat message to keep the client side alive
				select {
				case eventChan <- LogEvents{MessageType: LogEventsMessageTypeHeartbeat}:
				case <-done:
					return
				default:
					log.Warn("Failed to send heartbeat to client (channel blocked)")
				}
			}
		}
	}()

	// Main read loop
	for {
		// Check if context is done before attempting to read
		select {
		case <-done:
			return nil
		default:
			// Continue with read
		}

		// Read from WebSocket
		_, message, err := wsConn.ReadMessage()
		if err != nil {
			// Check for normal closure
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				log.Info("WebSocket closed normally")
				return nil
			}

			// Check for timeout - we'll try to keep the connection alive
			if strings.Contains(err.Error(), "i/o timeout") || strings.Contains(err.Error(), "deadline exceeded") {
				log.Warn("WebSocket read timeout, attempting to keep connection alive")

				// Send a ping to check if connection is still alive
				err := wsConn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(5*time.Second))
				if err != nil {
					log.Errorf("Failed to send ping after timeout, connection appears dead: %v", err)
					return fmt.Errorf("websocket connection dead: %v", err)
				}

				// Reset the read deadline and continue
				_ = wsConn.SetReadDeadline(time.Now().Add(60 * time.Second))
				continue
			}

			// For any other error, return and let the caller handle reconnection if needed
			log.Errorf("WebSocket read error: %v", err)
			return fmt.Errorf("websocket read error: %v", err)
		}

		// Reset read deadline after successful read
		_ = wsConn.SetReadDeadline(time.Now().Add(60 * time.Second))

		// Parse the message
		var streamResp LokiStreamResponse
		if err := json.Unmarshal(message, &streamResp); err != nil {
			log.Warnf("Failed to unmarshal Loki stream response: %v", err)
			continue
		}

		// Process all logs from this response at once
		var allEvents []LogEvent

		for _, stream := range streamResp.Streams {
			// Get metadata for this stream
			instance, ok := stream.Stream["instance"]
			if !ok {
				log.Warnf("Stream missing instance label: %s", stream.Stream)
			}
			environmentID := stream.Stream[string(LokiLabelEnvironment)]
			teamID := stream.Stream[string(LokiLabelTeam)]
			projectID := stream.Stream[string(LokiLabelProject)]
			serviceID := stream.Stream[string(LokiLabelService)]
			deploymentID, ok := stream.Stream[string(LokiLabelDeployment)]
			if !ok {
				deploymentID = stream.Stream[string(LokiLabelBuild)]
			}

			for _, entry := range stream.Values {
				// Entry format is [timestamp, log message]
				if len(entry) != 2 {
					log.Warnf("Unprocessable log entry format from loki %v", entry)
					continue
				}

				// Parse timestamp
				var timestamp time.Time
				if ts, err := strconv.ParseInt(entry[0], 10, 64); err == nil {
					// Loki timestamps are in nanoseconds
					timestamp = time.Unix(0, ts)
				} else {
					log.Warnf("Failed to parse timestamp: %v", err)
					// Use current time as fallback
					timestamp = time.Now()
				}

				// Get the message
				message := entry[1]

				// Create log event and add it to the collection
				logEvent := LogEvent{
					PodName:   instance,
					Timestamp: timestamp,
					Message:   message,
					Metadata: LogMetadata{
						TeamID:        teamID,
						ProjectID:     projectID,
						EnvironmentID: environmentID,
						ServiceID:     serviceID,
						DeploymentID:  deploymentID,
					},
				}

				allEvents = append(allEvents, logEvent)
			}
		}

		// Send events from this batch to the channel if there are any
		if len(allEvents) > 0 {
			// Sort oldest first (ascending)
			sort.Slice(allEvents, func(i, j int) bool {
				return allEvents[i].Timestamp.Before(allEvents[j].Timestamp)
			})
			select {
			case eventChan <- LogEvents{MessageType: LogEventsMessageTypeLog, Logs: allEvents}:
			case <-done:
				// Context canceled
				return nil
			default:
				// Channel is blocked, log a warning but continue
				log.Warnf("Event channel blocked, couldn't send %d log events", len(allEvents))
			}
		}
	}
}
