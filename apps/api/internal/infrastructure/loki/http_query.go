package loki

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"time"

	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

// QueryLokiLogs handles both instant queries (query) and range queries (query_range)
// based on the provided options
func (self *LokiLogQuerier) QueryLokiLogs(
	ctx context.Context,
	opts LokiLogHTTPOptions,
) ([]LogEvent, error) {
	queryStr := fmt.Sprintf("{%s=\"%s\"}", opts.Label, opts.LabelValue)

	// Add extra filters
	if opts.RawFilter != "" {
		queryStr = fmt.Sprintf("%s %s", queryStr, opts.RawFilter)
	}

	// Build the request URL with parameters
	reqURL, err := url.Parse(self.endpoint)
	if err != nil {
		return nil, fmt.Errorf("unable to parse loki query URL: %v", err)
	}

	// Set the appropriate endpoint path
	reqURL.Path = "/loki/api/v1/query_range"

	// Add query parameters
	q := reqURL.Query()
	q.Set("query", queryStr)

	if opts.Time != nil {
		q.Set("time", strconv.FormatInt(opts.Time.Unix(), 10))
	}
	if opts.Limit != nil {
		// Cap it
		if *opts.Limit > 1000 {
			*opts.Limit = 1000
		}
		q.Set("limit", strconv.Itoa(int(*opts.Limit)))
	}
	if opts.Direction != nil {
		q.Set("direction", string(*opts.Direction))
	}
	if opts.Start != nil {
		q.Set("start", strconv.FormatInt(opts.Start.UnixNano(), 10))
	}
	if opts.End != nil {
		q.Set("end", strconv.FormatInt(opts.End.UnixNano(), 10))
	}
	if opts.Since != nil && opts.Start == nil {
		// Don't pass since directly to loki but use the same logic they do
		// Calculated as duration from end, superceeded by start
		end := opts.End
		if end == nil {
			end = utils.ToPtr(time.Now())
		}
		startTime := (*end).Add(-*opts.Since)
		q.Set("start", strconv.FormatInt(startTime.UnixNano(), 10))
	}

	reqURL.RawQuery = q.Encode()

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %v", err)
	}

	// Execute the request
	resp, err := self.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute Loki query: %v", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("loki query failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	// Process the query result
	return ParseLokiResponse(resp, opts)
}

// ParseLokiResponse parses a Loki HTTP API response and returns LogEvents
func ParseLokiResponse(resp *http.Response, opts LokiLogHTTPOptions) ([]LogEvent, error) {
	// Read and parse the response
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	var queryResp LokiQueryResponse
	if err := json.Unmarshal(bodyBytes, &queryResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal Loki response: %v", err)
	}

	// Check response status
	if queryResp.Status != "success" {
		return nil, fmt.Errorf("loki query returned error: %s - %s", queryResp.ErrorType, queryResp.Error)
	}

	// Process the query result based on result type
	allEvents := []LogEvent{}

	switch queryResp.Data.ResultType {
	case "streams":
		// Parse streams result
		var streams []Stream
		if err := json.Unmarshal(queryResp.Data.Result, &streams); err != nil {
			return nil, fmt.Errorf("failed to unmarshal streams result: %v", err)
		}
		allEvents = parseStreamsResult(streams)

	case "matrix":
		// Parse matrix result (for range queries)
		var matrixValues []MatrixValue
		if err := json.Unmarshal(queryResp.Data.Result, &matrixValues); err != nil {
			return nil, fmt.Errorf("failed to unmarshal matrix result: %v", err)
		}
		allEvents = parseMatrixResult(matrixValues)

	case "vector":
		// Parse vector result (for instant queries)
		var vectorValues []VectorValue
		if err := json.Unmarshal(queryResp.Data.Result, &vectorValues); err != nil {
			return nil, fmt.Errorf("failed to unmarshal vector result: %v", err)
		}
		allEvents = parseVectorResult(vectorValues)

	default:
		return nil, fmt.Errorf("unsupported result type: %s", queryResp.Data.ResultType)
	}

	if opts.Direction != nil && *opts.Direction == LokiDirectionForward {
		// Sort oldest first (ascending)
		sort.Slice(allEvents, func(i, j int) bool {
			return allEvents[i].Timestamp.Before(allEvents[j].Timestamp)
		})
	} else {
		// Sort newest first (descending)
		sort.Slice(allEvents, func(i, j int) bool {
			return allEvents[i].Timestamp.After(allEvents[j].Timestamp)
		})
	}

	return allEvents, nil
}

// parseStreamsResult converts stream data to LogEvent objects
func parseStreamsResult(streams []Stream) []LogEvent {
	allEvents := []LogEvent{}

	for _, stream := range streams {
		// Extract metadata from stream labels
		instance := stream.Stream["instance"]
		environmentID := stream.Stream[string(LokiLabelEnvironment)]
		teamID := stream.Stream[string(LokiLabelTeam)]
		projectID := stream.Stream[string(LokiLabelProject)]
		serviceID := stream.Stream[string(LokiLabelService)]
		deploymentID, ok := stream.Stream[string(LokiLabelDeployment)]
		if !ok {
			deploymentID = stream.Stream[string(LokiLabelBuild)]
		}

		// Process each log entry
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

	return allEvents
}

// parseMatrixResult converts matrix data to LogEvent objects
func parseMatrixResult(matrixValues []MatrixValue) []LogEvent {
	allEvents := []LogEvent{}

	for _, series := range matrixValues {
		// Extract metadata from metric labels
		instance := series.Metric["instance"]
		environmentID := series.Metric[string(LokiLabelEnvironment)]
		teamID := series.Metric[string(LokiLabelTeam)]
		projectID := series.Metric[string(LokiLabelProject)]
		serviceID := series.Metric[string(LokiLabelService)]
		deploymentID := series.Metric[string(LokiLabelDeployment)]

		// For each sample in the series, create a log event
		for _, sample := range series.Values {
			timestamp := time.Unix(0, sample.Timestamp)

			// For matrix results, we may not have a direct log message
			// Instead, we format the value as the message
			message := fmt.Sprintf("Value: %f", sample.Value)

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

	return allEvents
}

// parseVectorResult converts vector data to LogEvent objects
func parseVectorResult(vectorValues []VectorValue) []LogEvent {
	allEvents := []LogEvent{}

	for _, sample := range vectorValues {
		// Extract metadata from metric labels
		instance := sample.Metric["instance"]
		environmentID := sample.Metric[string(LokiLabelEnvironment)]
		teamID := sample.Metric[string(LokiLabelTeam)]
		projectID := sample.Metric[string(LokiLabelProject)]
		serviceID := sample.Metric[string(LokiLabelService)]
		deploymentID := sample.Metric[string(LokiLabelDeployment)]

		// Create a timestamp from the sample
		timestamp := time.Unix(0, sample.Value.Timestamp)

		// For vector results, we may not have a direct log message
		// Instead, we format the value as the message
		message := fmt.Sprintf("Value: %f", sample.Value.Value)

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

	return allEvents
}
