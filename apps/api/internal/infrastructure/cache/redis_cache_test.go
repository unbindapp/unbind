package cache

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/go-redis/redismock/v9"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

// User is a test struct for cache storage
type User struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// RedisCacheSuite is a test suite for the Cache implementation
type RedisCacheSuite struct {
	suite.Suite
	mockClient  *redis.Client
	mock        redismock.ClientMock
	stringCache *RedisCache[string]
	intCache    *RedisCache[int]
	userCache   *RedisCache[User]
	ctx         context.Context
}

// SetupTest runs before each test
func (s *RedisCacheSuite) SetupTest() {
	s.mockClient, s.mock = redismock.NewClientMock()
	s.stringCache = NewCache[string](s.mockClient, "test")
	s.intCache = NewCache[int](s.mockClient, "int-test")
	s.userCache = NewCache[User](s.mockClient, "user-test")
	s.ctx = context.Background()
}

// TearDownTest cleans up after each test
func (s *RedisCacheSuite) TearDownTest() {
	s.mock.ClearExpect()
}

// TestSet tests the Set method
func (s *RedisCacheSuite) TestSet() {
	// Set up expectation
	s.mock.ExpectSet("test:key1", "\"value1\"", 0).SetVal("OK")

	// Call method
	err := s.stringCache.Set(s.ctx, "key1", "value1")

	// Assert
	assert.NoError(s.T(), err)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestSetWithExpiration tests the SetWithExpiration method
func (s *RedisCacheSuite) TestSetWithExpiration() {
	// Set up expectation
	s.mock.ExpectSet("test:key1", "\"value1\"", 10*time.Minute).SetVal("OK")

	// Call method
	err := s.stringCache.SetWithExpiration(s.ctx, "key1", "value1", 10*time.Minute)

	// Assert
	assert.NoError(s.T(), err)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestGet tests the Get method
func (s *RedisCacheSuite) TestGet() {
	// Set up expectation
	s.mock.ExpectGet("test:key1").SetVal("\"value1\"")

	// Call method
	value, err := s.stringCache.Get(s.ctx, "key1")

	// Assert
	assert.NoError(s.T(), err)
	assert.Equal(s.T(), "value1", value)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestGetdel tests the Getdel method
func (s *RedisCacheSuite) TestGetdel() {
	// Set up expectation
	s.mock.ExpectGetDel("test:key1").SetVal("\"value1\"")

	// Call method
	value, err := s.stringCache.Getdel(s.ctx, "key1")

	// Assert
	assert.NoError(s.T(), err)
	assert.Equal(s.T(), "value1", value)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestGet_NotFound tests the Get method when key is not found
func (s *RedisCacheSuite) TestGet_NotFound() {
	// Set up expectation
	s.mock.ExpectGet("test:nonexistent").RedisNil()

	// Call method
	_, err := s.stringCache.Get(s.ctx, "nonexistent")

	// Assert
	assert.Error(s.T(), err)
	assert.Equal(s.T(), redis.Nil, err)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestGetWithTTL tests the GetWithTTL method
func (s *RedisCacheSuite) TestGetWithTTL() {
	// Set up expectations
	s.mock.ExpectGet("test:key1").SetVal("\"value1\"")
	s.mock.ExpectTTL("test:key1").SetVal(5 * time.Minute)

	// Call method
	value, ttl, err := s.stringCache.GetWithTTL(s.ctx, "key1")

	// Assert
	assert.NoError(s.T(), err)
	assert.Equal(s.T(), "value1", value)
	assert.Equal(s.T(), 5*time.Minute, ttl)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestGetWithTTL_NoExpiry tests the GetWithTTL method for keys with no expiration
func (s *RedisCacheSuite) TestGetWithTTL_NoExpiry() {
	// Set up expectations
	s.mock.ExpectGet("test:key1").SetVal("\"value1\"")
	s.mock.ExpectTTL("test:key1").SetVal(-1)

	// Call method
	value, ttl, err := s.stringCache.GetWithTTL(s.ctx, "key1")

	// Assert
	assert.NoError(s.T(), err)
	assert.Equal(s.T(), "value1", value)
	assert.Equal(s.T(), time.Duration(-1), ttl)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestDelete tests the Delete method
func (s *RedisCacheSuite) TestDelete() {
	// Set up expectation
	s.mock.ExpectDel("test:key1").SetVal(1)

	// Call method
	err := s.stringCache.Delete(s.ctx, "key1")

	// Assert
	assert.NoError(s.T(), err)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestDeleteAll tests the DeleteAll method
func (s *RedisCacheSuite) TestDeleteAll() {
	// Set up expectations
	s.mock.ExpectKeys("test:*").SetVal([]string{"test:key1", "test:key2"})
	s.mock.ExpectDel("test:key1", "test:key2").SetVal(2)

	// Call method
	err := s.stringCache.DeleteAll(s.ctx)

	// Assert
	assert.NoError(s.T(), err)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestDeleteAll_NoKeys tests the DeleteAll method when no keys match
func (s *RedisCacheSuite) TestDeleteAll_NoKeys() {
	// Set up expectation
	s.mock.ExpectKeys("test:*").SetVal([]string{})

	// Call method
	err := s.stringCache.DeleteAll(s.ctx)

	// Assert
	assert.NoError(s.T(), err)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestDeleteAll_NoPrefix tests the DeleteAll method when no prefix is set
func (s *RedisCacheSuite) TestDeleteAll_NoPrefix() {
	// Create cache with no prefix
	noPrefix := NewCache[string](s.mockClient, "")

	// Call method
	err := noPrefix.DeleteAll(s.ctx)

	// Assert
	assert.Error(s.T(), err)
	assert.Contains(s.T(), err.Error(), "without a prefix")
}

// TestExists tests the Exists method
func (s *RedisCacheSuite) TestExists() {
	// Set up expectation
	s.mock.ExpectExists("test:key1").SetVal(1)

	// Call method
	exists, err := s.stringCache.Exists(s.ctx, "key1")

	// Assert
	assert.NoError(s.T(), err)
	assert.True(s.T(), exists)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestExists_NotFound tests the Exists method when key doesn't exist
func (s *RedisCacheSuite) TestExists_NotFound() {
	// Set up expectation
	s.mock.ExpectExists("test:nonexistent").SetVal(0)

	// Call method
	exists, err := s.stringCache.Exists(s.ctx, "nonexistent")

	// Assert
	assert.NoError(s.T(), err)
	assert.False(s.T(), exists)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestKeys tests the Keys method
func (s *RedisCacheSuite) TestKeys() {
	// Set up expectation
	s.mock.ExpectKeys("test:*").SetVal([]string{"test:key1", "test:key2"})

	// Call method
	keys, err := s.stringCache.Keys(s.ctx)

	// Assert
	assert.NoError(s.T(), err)
	assert.ElementsMatch(s.T(), []string{"key1", "key2"}, keys)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestKeys_NoPrefix tests the Keys method when no prefix is set
func (s *RedisCacheSuite) TestKeys_NoPrefix() {
	// Create cache with no prefix
	noPrefix := NewCache[string](s.mockClient, "")

	// Set up expectation
	s.mock.ExpectKeys("*").SetVal([]string{"key1", "key2"})

	// Call method
	keys, err := noPrefix.Keys(s.ctx)

	// Assert
	assert.NoError(s.T(), err)
	assert.ElementsMatch(s.T(), []string{"key1", "key2"}, keys)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestGetAll tests the GetAll method
func (s *RedisCacheSuite) TestGetAll() {
	// Set up expectations
	s.mock.ExpectKeys("test:*").SetVal([]string{"test:key1", "test:key2"})
	s.mock.ExpectGet("test:key1").SetVal("\"value1\"")
	s.mock.ExpectGet("test:key2").SetVal("\"value2\"")

	// Call method
	items, err := s.stringCache.GetAll(s.ctx)

	// Assert
	assert.NoError(s.T(), err)
	assert.Equal(s.T(), map[string]string{
		"key1": "value1",
		"key2": "value2",
	}, items)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestGetAll_WithMissingKey tests the GetAll method when one key is missing
func (s *RedisCacheSuite) TestGetAll_WithMissingKey() {
	// Set up expectations
	s.mock.ExpectKeys("test:*").SetVal([]string{"test:key1", "test:key2"})
	s.mock.ExpectGet("test:key1").SetVal("\"value1\"")
	s.mock.ExpectGet("test:key2").RedisNil()

	// Call method
	items, err := s.stringCache.GetAll(s.ctx)

	// Assert
	assert.NoError(s.T(), err)
	assert.Equal(s.T(), map[string]string{
		"key1": "value1",
	}, items)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestStructEncoding tests encoding and decoding of struct values
func (s *RedisCacheSuite) TestStructEncoding() {
	user := User{ID: 1, Name: "John", Email: "john@example.com"}
	userJSON, _ := json.Marshal(user)

	// Set up expectations
	s.mock.ExpectSet("user-test:user1", string(userJSON), 0).SetVal("OK")
	s.mock.ExpectGet("user-test:user1").SetVal(string(userJSON))

	// Test Set with a struct
	err := s.userCache.Set(s.ctx, "user1", user)
	assert.NoError(s.T(), err)

	// Test Get with a struct
	retrievedUser, err := s.userCache.Get(s.ctx, "user1")
	assert.NoError(s.T(), err)
	assert.Equal(s.T(), user, retrievedUser)

	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestIncrementInt tests the Increment function with int type
func (s *RedisCacheSuite) TestIncrementInt() {
	// Set up expectation
	s.mock.ExpectIncrBy("int-test:counter", 5).SetVal(10)

	// Call method
	newValue, err := Increment(s.ctx, s.intCache, "counter", 5)

	// Assert
	assert.NoError(s.T(), err)
	assert.Equal(s.T(), 10, newValue)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestIncrementFloat64 tests the Increment function with float64 type
func (s *RedisCacheSuite) TestIncrementFloat64() {
	// Create a float cache
	floatCache := NewCache[float64](s.mockClient, "float-test")

	// Set up expectation
	s.mock.ExpectIncrByFloat("float-test:counter", 2.5).SetVal(15.5)

	// Call method
	newValue, err := Increment(s.ctx, floatCache, "counter", 2.5)

	// Assert
	assert.NoError(s.T(), err)
	assert.Equal(s.T(), 15.5, newValue)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// TestStringCache tests the specialized string cache
func (s *RedisCacheSuite) TestStringCache() {
	// Create a string cache
	stringCache := NewStringCache(s.mockClient, "string-test")

	// Verify we're using StringValueCoder
	assert.IsType(s.T(), StringValueCoder{}, stringCache.coder)

	// Set up expectation
	s.mock.ExpectSet("string-test:key1", "direct-string", 0).SetVal("OK")

	// Call method
	err := stringCache.Set(s.ctx, "key1", "direct-string")

	// Assert
	assert.NoError(s.T(), err)
	assert.NoError(s.T(), s.mock.ExpectationsWereMet())
}

// Run the test suite
func TestRedisCacheSuite(t *testing.T) {
	suite.Run(t, new(RedisCacheSuite))
}

// Test the JSONValueCoder directly
func TestJSONValueCoder(t *testing.T) {
	coder := JSONValueCoder[User]{}

	// Test encoding
	user := User{ID: 123, Name: "Alice", Email: "alice@example.com"}
	encoded, err := coder.Encode(user)
	assert.NoError(t, err)

	// Verify it's valid JSON
	var decodedMap map[string]any
	err = json.Unmarshal([]byte(encoded), &decodedMap)
	assert.NoError(t, err)
	assert.Equal(t, float64(123), decodedMap["id"])
	assert.Equal(t, "Alice", decodedMap["name"])
	assert.Equal(t, "alice@example.com", decodedMap["email"])

	// Test decoding
	decoded, err := coder.Decode(encoded)
	assert.NoError(t, err)
	assert.Equal(t, user, decoded)

	// Test decoding invalid JSON
	_, err = coder.Decode("invalid json")
	assert.Error(t, err)
}

// Test the StringValueCoder directly
func TestStringValueCoder(t *testing.T) {
	coder := StringValueCoder{}

	// Test encoding
	encoded, err := coder.Encode("hello world")
	assert.NoError(t, err)
	assert.Equal(t, "hello world", encoded)

	// Test decoding
	decoded, err := coder.Decode(encoded)
	assert.NoError(t, err)
	assert.Equal(t, "hello world", decoded)
}

// Test creating cache with custom coder
func TestWithCoder(t *testing.T) {
	client, _ := redismock.NewClientMock()
	cache := NewCache[string](client, "test")

	// Create a custom coder
	customCoder := StringValueCoder{}

	// Apply the custom coder
	result := cache.WithCoder(customCoder)

	// Assert it returns self for chaining
	assert.Same(t, cache, result)

	// Assert the coder was set
	assert.Equal(t, customCoder, cache.coder)
}

// Test fullKey method
func TestFullKey(t *testing.T) {
	client, _ := redismock.NewClientMock()

	// Cache with prefix
	cache := NewCache[string](client, "prefix")
	assert.Equal(t, "prefix:key", cache.fullKey("key"))

	// Cache without prefix
	cacheNoPrefix := NewCache[string](client, "")
	assert.Equal(t, "key", cacheNoPrefix.fullKey("key"))
}
