package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

// Default poll interval for processor
const POLL_INTERVAL = 5 * time.Second

// Default concurrency for processor
const QUEUE_CONCURRENCY = 2

// Prirority queue implementation using redis sorted set
type Queue[T any] struct {
	client       *redis.Client
	key          string
	pollInterval time.Duration
}

// Item in queue and metadata
type QueueItem[T any] struct {
	ID         string    `json:"id"`
	Data       T         `json:"data"`
	EnqueuedAt time.Time `json:"enqueued_at"`
	Priority   int       `json:"priority"`
}

func NewQueue[T any](client *redis.Client, key string) *Queue[T] {
	return &Queue[T]{
		client:       client,
		key:          key,
		pollInterval: POLL_INTERVAL,
	}
}

// Add an item to queue
// ! TODO - now we don't care about priority but we might in the future (e.g. production vs dev environment)
func (q *Queue[T]) Enqueue(ctx context.Context, id string, data T) error {
	item := &QueueItem[T]{
		ID:         id,
		Data:       data,
		EnqueuedAt: time.Now(),
		Priority:   0,
	}

	// Serialize item to JSON
	itemData, err := json.Marshal(item)
	if err != nil {
		return err
	}

	// Calculate priority based on timestamp
	// ! We would subtract priority * 1000000 here, for priority
	score := float64(time.Now().Unix())

	return q.client.ZAdd(ctx, q.key, redis.Z{
		Score:  score,
		Member: string(itemData),
	}).Err()
}

// Dequeue removes and returns highest priority item
func (q *Queue[T]) Dequeue(ctx context.Context) (*QueueItem[T], error) {
	results, err := q.client.ZRange(ctx, q.key, 0, 0).Result()
	if err != nil {
		return nil, err
	}

	if len(results) == 0 {
		return nil, nil
	}

	// Deserialize item from JSON
	var item QueueItem[T]
	if err := json.Unmarshal([]byte(results[0]), &item); err != nil {
		return nil, err
	}

	// Remove from queue
	if err := q.client.ZRem(ctx, q.key, results[0]).Err(); err != nil {
		return nil, err
	}

	return &item, nil
}

// Peek returns the highest priority item without removing it
func (q *Queue[T]) Peek(ctx context.Context) (*QueueItem[T], error) {
	results, err := q.client.ZRange(ctx, q.key, 0, 0).Result()
	if err != nil {
		return nil, err
	}

	if len(results) == 0 {
		return nil, nil
	}

	// Deserialize item from JSON
	var item QueueItem[T]
	if err := json.Unmarshal([]byte(results[0]), &item); err != nil {
		return nil, err
	}

	return &item, nil
}

// DequeueN removes and returns up to N items
func (q *Queue[T]) DequeueN(ctx context.Context, n int) ([]*QueueItem[T], error) {
	if n <= 0 {
		n = 1
	}

	// Get the oldest items (lowest scores)
	results, err := q.client.ZRange(ctx, q.key, 0, int64(n-1)).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get items from queue: %w", err)
	}

	if len(results) == 0 {
		return []*QueueItem[T]{}, nil
	}

	// Deserialize the items
	items := make([]*QueueItem[T], 0, len(results))
	for _, result := range results {
		var item QueueItem[T]
		if err := json.Unmarshal([]byte(result), &item); err != nil {
			return nil, fmt.Errorf("failed to deserialize queue item: %w", err)
		}
		items = append(items, &item)

		// Remove from the queue
		err = q.client.ZRem(ctx, q.key, result).Err()
		if err != nil {
			return nil, fmt.Errorf("failed to remove item from queue: %w", err)
		}
	}

	return items, nil
}

// GetAll returns all items in the queue ordered by insertion time
func (q *Queue[T]) GetAll(ctx context.Context) ([]*QueueItem[T], error) {
	results, err := q.client.ZRange(ctx, q.key, 0, -1).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get items from queue: %w", err)
	}

	// Deserialize the items
	items := make([]*QueueItem[T], 0, len(results))
	for _, result := range results {
		var item QueueItem[T]
		if err := json.Unmarshal([]byte(result), &item); err != nil {
			return nil, fmt.Errorf("failed to deserialize queue item: %w", err)
		}
		items = append(items, &item)
	}

	return items, nil
}

// Size returns the number of items in the queue
func (q *Queue[T]) Size(ctx context.Context) (int64, error) {
	return q.client.ZCard(ctx, q.key).Result()
}

// Remove removes an item with the given ID from the queue
func (q *Queue[T]) Remove(ctx context.Context, id string) error {
	// Get all items
	results, err := q.client.ZRange(ctx, q.key, 0, -1).Result()
	if err != nil {
		return fmt.Errorf("failed to get items from queue: %w", err)
	}

	// Find and remove the item
	for _, result := range results {
		var item QueueItem[T]
		if err := json.Unmarshal([]byte(result), &item); err != nil {
			continue
		}

		if item.ID == id {
			err = q.client.ZRem(ctx, q.key, result).Err()
			if err != nil {
				return fmt.Errorf("failed to remove item from queue: %w", err)
			}
			return nil
		}
	}

	return fmt.Errorf("item with ID %s not found in queue", id)
}

func (q *Queue[T]) StartProcessor(ctx context.Context, processor func(ctx context.Context, item *QueueItem[T]) error, jobCounter func(ctx context.Context) (int, error)) {
	go func() {
		ticker := time.NewTicker(q.pollInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				// Check how many active jobs are running in Kubernetes
				activeJobs, err := jobCounter(ctx)
				if err != nil {
					log.Errorf("Error counting active jobs: %v", err)
					continue
				}

				// Calculate available slots
				availableSlots := QUEUE_CONCURRENCY - activeJobs
				if availableSlots <= 0 {
					continue
				}

				// Try to dequeue up to availableSlots items
				items, err := q.DequeueN(ctx, availableSlots)
				if err != nil || len(items) == 0 {
					continue
				}

				// Process each item
				for _, item := range items {
					// Process the item directly without additional goroutines
					// since we're already limiting based on active K8s jobs
					go func(i *QueueItem[T]) {
						if err := processor(ctx, i); err != nil {
							log.Errorf("Error processing item %s: %v", i.ID, err)
						}
					}(item)
				}
			}
		}
	}()
}
