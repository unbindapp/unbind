package k8s

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/infrastructure/loki"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// StreamPodLogs streams logs from a pod to the provided writer with filtering
func (self *KubeClient) StreamPodLogs(
	ctx context.Context,
	namespace string,
	opts loki.LokiLogStreamOptions,
	meta loki.LogMetadata,
	client kubernetes.Interface,
	eventChan chan<- loki.LogEvents,
) error {
	// Get pods for labels
	pods, err := self.GetPodsByLabels(ctx, namespace, map[string]string{"unbind-deployment": opts.LabelValue}, client)
	if err != nil {
		return fmt.Errorf("failed to get pods with label %s: %w", opts.LabelValue, err)
	}
	if len(pods.Items) == 0 {
		return fmt.Errorf("no pods found with label %s", opts.LabelValue)
	}
	podName := pods.Items[0].Name

	podLogOptions := &corev1.PodLogOptions{
		Follow:     true,
		Timestamps: true,
	}
	if opts.Since > 0 {
		podLogOptions.SinceSeconds = utils.ToPtr(int64(opts.Since.Seconds()))
	}
	if !opts.Start.IsZero() {
		podLogOptions.SinceTime = &metav1.Time{
			Time: opts.Start,
		}
	}
	if opts.Limit > 0 {
		podLogOptions.TailLines = utils.ToPtr(int64(opts.Limit))
	}

	req := client.CoreV1().Pods(namespace).GetLogs(podName, podLogOptions)
	stream, err := req.Stream(ctx)
	if err != nil {
		return fmt.Errorf("error opening log stream for pod %s: %v", podName, err)
	}
	defer stream.Close()

	reader := bufio.NewReader(stream)

	const (
		batchSize    = 100
		maxBatchWait = 200 * time.Millisecond
	)

	// Channels for reading lines
	linesChan := make(chan string)
	readErrChan := make(chan error, 1)

	// Kick off a goroutine to read the lines from the stream
	go func() {
		defer close(linesChan)
		for {
			line, err := reader.ReadBytes('\n')
			if err != nil {
				// Send the error and break
				readErrChan <- err
				return
			}
			linesChan <- string(line)
		}
	}()

	batch := make([]loki.LogEvent, 0, batchSize)
	timer := time.NewTimer(maxBatchWait)
	// Initially send an empty meessage even if there's no logs
	sentFirstMessage := false

	// Function to send the current batch to the channel
	sendBatch := func() {
		if len(batch) == 0 && sentFirstMessage {
			return
		}

		sentFirstMessage = true
		events := make([]loki.LogEvent, len(batch))
		copy(events, batch)

		select {
		case eventChan <- loki.LogEvents{Logs: events}:
			// Successfully sent
		case <-ctx.Done():
			// If context is canceled, just return
		}

		batch = batch[:0] // Clear the batch
	}

	// Make sure we start the timer from "now"
	if !timer.Stop() {
		<-timer.C
	}
	timer.Reset(maxBatchWait)

	// Main loop: block on either the timer, the context, or new lines
	for {
		select {
		case <-ctx.Done():
			// Context canceled, flush and quit
			sendBatch()
			return nil

		case err := <-readErrChan:
			// Could be io.EOF or a real error
			if err == io.EOF {
				sendBatch()
				return nil
			}
			return fmt.Errorf("error reading from log stream: %v", err)

		case <-timer.C:
			// Timer fired: flush partial batch
			sendBatch()
			// Reset the timer
			timer.Reset(maxBatchWait)

		case line, ok := <-linesChan:
			// New line from the stream
			if !ok {
				// Channel closed, no more data
				sendBatch()
				return nil
			}

			// Filter if needed
			if opts.RawFilter != "" && !strings.Contains(line, opts.RawFilter) {
				continue
			}

			// Extract timestamps if requested
			var timestamp time.Time
			var message string
			parts := strings.SplitN(line, " ", 2)
			if len(parts) == 2 {
				tsCandidate := strings.TrimSpace(parts[0])
				msgCandidate := strings.TrimSpace(parts[1])
				if t, err := time.Parse(time.RFC3339Nano, tsCandidate); err == nil {
					timestamp = t
					message = msgCandidate
				} else {
					// Couldn't parse, treat entire thing as message
					message = line
				}
			} else {
				message = line
			}

			batch = append(batch, loki.LogEvent{
				PodName:   podName,
				Timestamp: timestamp,
				Message:   message,
				Metadata:  meta,
			})

			// If the batch is full, send it now and reset timer
			if len(batch) >= batchSize {
				sendBatch()
				if !timer.Stop() {
					<-timer.C
				}
				timer.Reset(maxBatchWait)
			}
		}
	}
}
