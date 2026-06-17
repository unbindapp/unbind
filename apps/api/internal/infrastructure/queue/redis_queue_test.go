package queue

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/suite"
)

// Test data structures
type TestData struct {
	Name    string `json:"name"`
	Value   int    `json:"value"`
	Message string `json:"message"`
}

type RedisQueueTestSuite struct {
	suite.Suite
	miniRedis   *miniredis.Miniredis
	redisClient *redis.Client
	ctx         context.Context
	cancel      context.CancelFunc
	queue       *Queue[TestData]
	queueKey    string
}

func (s *RedisQueueTestSuite) SetupTest() {
	s.ctx, s.cancel = context.WithTimeout(context.Background(), 30*time.Second)

	// Setup miniredis
	var err error
	s.miniRedis, err = miniredis.Run()
	s.Require().NoError(err)

	// Setup Redis client
	s.redisClient = redis.NewClient(&redis.Options{
		Addr: s.miniRedis.Addr(),
	})

	// Setup queue
	s.queueKey = "test:queue"
	s.queue = NewQueue[TestData](s.redisClient, s.queueKey)
}

func (s *RedisQueueTestSuite) TearDownTest() {
	if s.cancel != nil {
		s.cancel()
	}
	if s.redisClient != nil {
		s.redisClient.Close()
	}
	if s.miniRedis != nil {
		s.miniRedis.Close()
	}
}

func (s *RedisQueueTestSuite) createTestData(name string, value int) TestData {
	return TestData{
		Name:    name,
		Value:   value,
		Message: fmt.Sprintf("Test message for %s with value %d", name, value),
	}
}

func (s *RedisQueueTestSuite) TestNewQueue() {
	testKey := "test:new:queue"
	testQueue := NewQueue[TestData](s.redisClient, testKey)

	s.NotNil(testQueue)
	s.Equal(s.redisClient, testQueue.client)
	s.Equal(testKey, testQueue.key)
	s.Equal(POLL_INTERVAL, testQueue.pollInterval)
}

func (s *RedisQueueTestSuite) TestEnqueue_Success() {
	data := s.createTestData("test-item", 42)
	id := "test-id-1"

	err := s.queue.Enqueue(s.ctx, id, data)

	s.NoError(err)

	// Verify item was added to Redis
	size, err := s.queue.Size(s.ctx)
	s.NoError(err)
	s.Equal(int64(1), size)

	// Verify the item can be retrieved
	item, err := s.queue.Peek(s.ctx)
	s.NoError(err)
	s.NotNil(item)
	s.Equal(id, item.ID)
	s.Equal(data, item.Data)
	s.Equal(0, item.Priority)
	s.WithinDuration(time.Now(), item.EnqueuedAt, time.Second)
}

func (s *RedisQueueTestSuite) TestEnqueue_MultipleItems() {
	items := []struct {
		id   string
		data TestData
	}{
		{"id-1", s.createTestData("item-1", 10)},
		{"id-2", s.createTestData("item-2", 20)},
		{"id-3", s.createTestData("item-3", 30)},
	}

	// Enqueue items with small delays to ensure different timestamps
	for i, item := range items {
		err := s.queue.Enqueue(s.ctx, item.id, item.data)
		s.NoError(err)

		if i < len(items)-1 {
			time.Sleep(10 * time.Millisecond) // Ensure different timestamps
		}
	}

	size, err := s.queue.Size(s.ctx)
	s.NoError(err)
	s.Equal(int64(3), size)
}

func (s *RedisQueueTestSuite) TestEnqueue_InvalidContext() {
	data := s.createTestData("test-item", 42)

	// Create a cancelled context
	cancelledCtx, cancel := context.WithCancel(context.Background())
	cancel()

	err := s.queue.Enqueue(cancelledCtx, "test-id", data)
	s.Error(err)
}

func (s *RedisQueueTestSuite) TestDequeue_Success() {
	data := s.createTestData("test-item", 42)
	id := "test-id-1"

	// Enqueue an item
	err := s.queue.Enqueue(s.ctx, id, data)
	s.NoError(err)

	// Dequeue the item
	item, err := s.queue.Dequeue(s.ctx)
	s.NoError(err)
	s.NotNil(item)
	s.Equal(id, item.ID)
	s.Equal(data, item.Data)

	// Verify queue is empty
	size, err := s.queue.Size(s.ctx)
	s.NoError(err)
	s.Equal(int64(0), size)
}

func (s *RedisQueueTestSuite) TestDequeue_EmptyQueue() {
	item, err := s.queue.Dequeue(s.ctx)
	s.NoError(err)
	s.Nil(item)
}

func (s *RedisQueueTestSuite) TestDequeue_FIFO() {
	// Enqueue multiple items with delays to ensure order
	items := []struct {
		id   string
		data TestData
	}{
		{"first", s.createTestData("first-item", 1)},
		{"second", s.createTestData("second-item", 2)},
		{"third", s.createTestData("third-item", 3)},
	}

	for i, item := range items {
		err := s.queue.Enqueue(s.ctx, item.id, item.data)
		s.NoError(err)

		if i < len(items)-1 {
			time.Sleep(10 * time.Millisecond) // Ensure different timestamps
		}
	}

	// Dequeue items and verify FIFO order
	for _, expectedItem := range items {
		dequeuedItem, err := s.queue.Dequeue(s.ctx)
		s.NoError(err)
		s.NotNil(dequeuedItem)
		s.Equal(expectedItem.id, dequeuedItem.ID)
		s.Equal(expectedItem.data, dequeuedItem.Data)
	}

	// Verify queue is empty
	size, err := s.queue.Size(s.ctx)
	s.NoError(err)
	s.Equal(int64(0), size)
}

func (s *RedisQueueTestSuite) TestPeek_Success() {
	data := s.createTestData("test-item", 42)
	id := "test-id-1"

	// Enqueue an item
	err := s.queue.Enqueue(s.ctx, id, data)
	s.NoError(err)

	// Peek at the item
	item, err := s.queue.Peek(s.ctx)
	s.NoError(err)
	s.NotNil(item)
	s.Equal(id, item.ID)
	s.Equal(data, item.Data)

	// Verify item is still in queue
	size, err := s.queue.Size(s.ctx)
	s.NoError(err)
	s.Equal(int64(1), size)
}

func (s *RedisQueueTestSuite) TestPeek_EmptyQueue() {
	item, err := s.queue.Peek(s.ctx)
	s.NoError(err)
	s.Nil(item)
}

func (s *RedisQueueTestSuite) TestDequeueN_Success() {
	// Enqueue multiple items
	itemCount := 5
	for i := 0; i < itemCount; i++ {
		data := s.createTestData(fmt.Sprintf("item-%d", i), i)
		err := s.queue.Enqueue(s.ctx, fmt.Sprintf("id-%d", i), data)
		s.NoError(err)
		time.Sleep(5 * time.Millisecond) // Ensure different timestamps
	}

	// Dequeue 3 items
	items, err := s.queue.DequeueN(s.ctx, 3)
	s.NoError(err)
	s.Len(items, 3)

	// Verify FIFO order
	for i, item := range items {
		s.Equal(fmt.Sprintf("id-%d", i), item.ID)
		s.Equal(fmt.Sprintf("item-%d", i), item.Data.Name)
		s.Equal(i, item.Data.Value)
	}

	// Verify remaining items in queue
	size, err := s.queue.Size(s.ctx)
	s.NoError(err)
	s.Equal(int64(2), size)
}

func (s *RedisQueueTestSuite) TestDequeueN_MoreThanAvailable() {
	// Enqueue 2 items
	for i := 0; i < 2; i++ {
		data := s.createTestData(fmt.Sprintf("item-%d", i), i)
		err := s.queue.Enqueue(s.ctx, fmt.Sprintf("id-%d", i), data)
		s.NoError(err)
		time.Sleep(5 * time.Millisecond)
	}

	// Try to dequeue 5 items (more than available)
	items, err := s.queue.DequeueN(s.ctx, 5)
	s.NoError(err)
	s.Len(items, 2) // Should only return available items

	// Verify queue is empty
	size, err := s.queue.Size(s.ctx)
	s.NoError(err)
	s.Equal(int64(0), size)
}

func (s *RedisQueueTestSuite) TestDequeueN_EmptyQueue() {
	items, err := s.queue.DequeueN(s.ctx, 3)
	s.NoError(err)
	s.Empty(items)
}

func (s *RedisQueueTestSuite) TestDequeueN_ZeroOrNegativeN() {
	data := s.createTestData("test-item", 42)
	err := s.queue.Enqueue(s.ctx, "test-id", data)
	s.NoError(err)

	// Test with n = 0
	items, err := s.queue.DequeueN(s.ctx, 0)
	s.NoError(err)
	s.Len(items, 1) // Should default to 1

	// Enqueue another item
	err = s.queue.Enqueue(s.ctx, "test-id-2", data)
	s.NoError(err)

	// Test with negative n
	items, err = s.queue.DequeueN(s.ctx, -5)
	s.NoError(err)
	s.Len(items, 1) // Should default to 1
}

func (s *RedisQueueTestSuite) TestGetAll_Success() {
	// Enqueue multiple items
	itemCount := 3
	for i := 0; i < itemCount; i++ {
		data := s.createTestData(fmt.Sprintf("item-%d", i), i)
		err := s.queue.Enqueue(s.ctx, fmt.Sprintf("id-%d", i), data)
		s.NoError(err)
		time.Sleep(5 * time.Millisecond)
	}

	// Get all items
	items, err := s.queue.GetAll(s.ctx)
	s.NoError(err)
	s.Len(items, itemCount)

	// Verify order and content
	for i, item := range items {
		s.Equal(fmt.Sprintf("id-%d", i), item.ID)
		s.Equal(fmt.Sprintf("item-%d", i), item.Data.Name)
		s.Equal(i, item.Data.Value)
	}

	// Verify items are still in queue
	size, err := s.queue.Size(s.ctx)
	s.NoError(err)
	s.Equal(int64(itemCount), size)
}

func (s *RedisQueueTestSuite) TestGetAll_EmptyQueue() {
	items, err := s.queue.GetAll(s.ctx)
	s.NoError(err)
	s.Empty(items)
}

func (s *RedisQueueTestSuite) TestSize_EmptyQueue() {
	size, err := s.queue.Size(s.ctx)
	s.NoError(err)
	s.Equal(int64(0), size)
}

func (s *RedisQueueTestSuite) TestSize_WithItems() {
	itemCount := 5
	for i := 0; i < itemCount; i++ {
		data := s.createTestData(fmt.Sprintf("item-%d", i), i)
		err := s.queue.Enqueue(s.ctx, fmt.Sprintf("id-%d", i), data)
		s.NoError(err)
	}

	size, err := s.queue.Size(s.ctx)
	s.NoError(err)
	s.Equal(int64(itemCount), size)
}

func (s *RedisQueueTestSuite) TestRemove_Success() {
	// Enqueue multiple items
	items := []struct {
		id   string
		data TestData
	}{
		{"id-1", s.createTestData("item-1", 1)},
		{"id-2", s.createTestData("item-2", 2)},
		{"id-3", s.createTestData("item-3", 3)},
	}

	for _, item := range items {
		err := s.queue.Enqueue(s.ctx, item.id, item.data)
		s.NoError(err)
		time.Sleep(5 * time.Millisecond)
	}

	// Remove middle item
	err := s.queue.Remove(s.ctx, "id-2")
	s.NoError(err)

	// Verify size decreased
	size, err := s.queue.Size(s.ctx)
	s.NoError(err)
	s.Equal(int64(2), size)

	// Verify correct items remain
	allItems, err := s.queue.GetAll(s.ctx)
	s.NoError(err)
	s.Len(allItems, 2)
	s.Equal("id-1", allItems[0].ID)
	s.Equal("id-3", allItems[1].ID)
}

func (s *RedisQueueTestSuite) TestRemove_NotFound() {
	// Enqueue an item
	data := s.createTestData("test-item", 42)
	err := s.queue.Enqueue(s.ctx, "existing-id", data)
	s.NoError(err)

	// Try to remove non-existent item
	err = s.queue.Remove(s.ctx, "non-existent-id")
	s.Error(err)
	s.Contains(err.Error(), "not found in queue")

	// Verify original item still exists
	size, err := s.queue.Size(s.ctx)
	s.NoError(err)
	s.Equal(int64(1), size)
}

func (s *RedisQueueTestSuite) TestRemove_EmptyQueue() {
	err := s.queue.Remove(s.ctx, "any-id")
	s.Error(err)
	s.Contains(err.Error(), "not found in queue")
}

func (s *RedisQueueTestSuite) TestStartProcessor_Basic() {
	// Setup processed items tracking
	var processedItems []string
	var mu sync.Mutex

	processor := func(ctx context.Context, item *QueueItem[TestData]) error {
		mu.Lock()
		defer mu.Unlock()
		processedItems = append(processedItems, item.ID)
		return nil
	}

	jobCounter := func(ctx context.Context) (int, error) {
		return 0, nil // Always allow processing
	}

	// Set shorter poll interval for faster testing
	s.queue.pollInterval = 100 * time.Millisecond

	// Start processor
	processorCtx, processorCancel := context.WithCancel(s.ctx)
	s.queue.StartProcessor(processorCtx, processor, jobCounter)

	// Enqueue some items
	testItems := []string{"item-1", "item-2", "item-3"}
	for _, id := range testItems {
		data := s.createTestData(id, 1)
		err := s.queue.Enqueue(s.ctx, id, data)
		s.NoError(err)
	}

	// Wait for processing
	time.Sleep(300 * time.Millisecond)

	// Stop processor
	processorCancel()

	// Verify items were processed
	mu.Lock()
	defer mu.Unlock()
	s.Len(processedItems, len(testItems))
	for _, expectedID := range testItems {
		s.Contains(processedItems, expectedID)
	}

	// Verify queue is empty
	size, err := s.queue.Size(s.ctx)
	s.NoError(err)
	s.Equal(int64(0), size)
}

func (s *RedisQueueTestSuite) TestStartProcessor_Concurrency() {
	// Setup tracking for processed items
	var processedCount atomic.Int64

	processor := func(ctx context.Context, item *QueueItem[TestData]) error {
		processedCount.Add(1)
		return nil
	}

	jobCounter := func(ctx context.Context) (int, error) {
		return 0, nil // Always allow processing
	}

	// Set shorter poll interval
	s.queue.pollInterval = 50 * time.Millisecond

	// Start processor
	processorCtx, processorCancel := context.WithCancel(s.ctx)
	s.queue.StartProcessor(processorCtx, processor, jobCounter)

	// Enqueue items equal to queue concurrency
	for i := 0; i < QUEUE_CONCURRENCY; i++ {
		data := s.createTestData(fmt.Sprintf("item-%d", i), i)
		err := s.queue.Enqueue(s.ctx, fmt.Sprintf("id-%d", i), data)
		s.NoError(err)
	}

	// Wait for processing
	time.Sleep(200 * time.Millisecond)

	// Stop processor
	processorCancel()

	// Verify all items were processed
	s.Equal(int64(QUEUE_CONCURRENCY), processedCount.Load())
}

func (s *RedisQueueTestSuite) TestStartProcessor_JobCounterLimitsProcessing() {
	var processedCount atomic.Int64

	processor := func(ctx context.Context, item *QueueItem[TestData]) error {
		processedCount.Add(1)
		return nil
	}

	// Job counter that reports queue is full
	jobCounter := func(ctx context.Context) (int, error) {
		return QUEUE_CONCURRENCY, nil // Report full capacity
	}

	// Set shorter poll interval
	s.queue.pollInterval = 50 * time.Millisecond

	// Start processor
	processorCtx, processorCancel := context.WithCancel(s.ctx)
	s.queue.StartProcessor(processorCtx, processor, jobCounter)

	// Enqueue items
	for i := 0; i < 3; i++ {
		data := s.createTestData(fmt.Sprintf("item-%d", i), i)
		err := s.queue.Enqueue(s.ctx, fmt.Sprintf("id-%d", i), data)
		s.NoError(err)
	}

	// Wait for processing attempt
	time.Sleep(200 * time.Millisecond)

	// Stop processor
	processorCancel()

	// Verify no items were processed due to job counter
	s.Equal(int64(0), processedCount.Load())

	// Verify items are still in queue
	size, err := s.queue.Size(s.ctx)
	s.NoError(err)
	s.Equal(int64(3), size)
}

func (s *RedisQueueTestSuite) TestStartProcessor_ProcessorError() {
	var errorCount atomic.Int64

	processor := func(ctx context.Context, item *QueueItem[TestData]) error {
		errorCount.Add(1)
		return fmt.Errorf("processing error for item %s", item.ID)
	}

	jobCounter := func(ctx context.Context) (int, error) {
		return 0, nil
	}

	// Set shorter poll interval
	s.queue.pollInterval = 50 * time.Millisecond

	// Start processor
	processorCtx, processorCancel := context.WithCancel(s.ctx)
	s.queue.StartProcessor(processorCtx, processor, jobCounter)

	// Enqueue an item
	data := s.createTestData("error-item", 42)
	err := s.queue.Enqueue(s.ctx, "error-id", data)
	s.NoError(err)

	// Wait for processing
	time.Sleep(200 * time.Millisecond)

	// Stop processor
	processorCancel()

	// Verify error was encountered
	s.Equal(int64(1), errorCount.Load())

	// Verify item was removed from queue despite error
	size, err := s.queue.Size(s.ctx)
	s.NoError(err)
	s.Equal(int64(0), size)
}

func (s *RedisQueueTestSuite) TestStartProcessor_JobCounterError() {
	var processorCalled atomic.Bool

	processor := func(ctx context.Context, item *QueueItem[TestData]) error {
		processorCalled.Store(true)
		return nil
	}

	jobCounter := func(ctx context.Context) (int, error) {
		return 0, fmt.Errorf("job counter error")
	}

	// Set shorter poll interval
	s.queue.pollInterval = 50 * time.Millisecond

	// Start processor
	processorCtx, processorCancel := context.WithCancel(s.ctx)
	s.queue.StartProcessor(processorCtx, processor, jobCounter)

	// Enqueue an item
	data := s.createTestData("test-item", 42)
	err := s.queue.Enqueue(s.ctx, "test-id", data)
	s.NoError(err)

	// Wait for processing attempt
	time.Sleep(200 * time.Millisecond)

	// Stop processor
	processorCancel()

	// Verify processor was not called due to job counter error
	s.False(processorCalled.Load())

	// Verify item is still in queue
	size, err := s.queue.Size(s.ctx)
	s.NoError(err)
	s.Equal(int64(1), size)
}

func (s *RedisQueueTestSuite) TestStartProcessor_ContextCancellation() {
	var processedCount atomic.Int64

	processor := func(ctx context.Context, item *QueueItem[TestData]) error {
		processedCount.Add(1)
		return nil
	}

	jobCounter := func(ctx context.Context) (int, error) {
		return 0, nil
	}

	// Set shorter poll interval
	s.queue.pollInterval = 50 * time.Millisecond

	// Start processor with short-lived context
	processorCtx, processorCancel := context.WithTimeout(s.ctx, 100*time.Millisecond)
	s.queue.StartProcessor(processorCtx, processor, jobCounter)

	// Enqueue item after context should be cancelled
	time.Sleep(150 * time.Millisecond)

	data := s.createTestData("late-item", 42)
	err := s.queue.Enqueue(s.ctx, "late-id", data)
	s.NoError(err)

	// Wait a bit more
	time.Sleep(100 * time.Millisecond)

	// Cleanup
	processorCancel()

	// Verify no processing occurred after context cancellation
	s.Equal(int64(0), processedCount.Load())
}

func (s *RedisQueueTestSuite) TestQueue_TypeSafety() {
	// Test with different data types
	stringQueue := NewQueue[string](s.redisClient, "string-queue")
	intQueue := NewQueue[int](s.redisClient, "int-queue")

	// Test string queue
	err := stringQueue.Enqueue(s.ctx, "str-1", "hello world")
	s.NoError(err)

	strItem, err := stringQueue.Dequeue(s.ctx)
	s.NoError(err)
	s.NotNil(strItem)
	s.Equal("hello world", strItem.Data)

	// Test int queue
	err = intQueue.Enqueue(s.ctx, "int-1", 42)
	s.NoError(err)

	intItem, err := intQueue.Dequeue(s.ctx)
	s.NoError(err)
	s.NotNil(intItem)
	s.Equal(42, intItem.Data)
}

func (s *RedisQueueTestSuite) TestQueue_RedisFailure() {
	// Close the miniredis instance to simulate Redis failure
	s.miniRedis.Close()

	data := s.createTestData("test-item", 42)
	err := s.queue.Enqueue(s.ctx, "test-id", data)
	s.Error(err)

	_, err = s.queue.Dequeue(s.ctx)
	s.Error(err)

	_, err = s.queue.Size(s.ctx)
	s.Error(err)
}

func (s *RedisQueueTestSuite) TestConstants() {
	s.Equal(5*time.Second, POLL_INTERVAL)
	s.Equal(2, QUEUE_CONCURRENCY)
}

func TestRedisQueueTestSuite(t *testing.T) {
	suite.Run(t, new(RedisQueueTestSuite))
}
