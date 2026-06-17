package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// ValueCoder defines how values are encoded and decoded for Redis storage
type ValueCoder[T any] interface {
	Encode(value T) (string, error)
	Decode(encoded string) (T, error)
}

// JSONValueCoder implements ValueCoder using JSON encoding
type JSONValueCoder[T any] struct{}

func (c JSONValueCoder[T]) Encode(value T) (string, error) {
	bytes, err := json.Marshal(value)
	if err != nil {
		return "", fmt.Errorf("failed to encode value: %w", err)
	}
	return string(bytes), nil
}

func (c JSONValueCoder[T]) Decode(encoded string) (T, error) {
	var value T
	if err := json.Unmarshal([]byte(encoded), &value); err != nil {
		return value, fmt.Errorf("failed to decode value: %w", err)
	}
	return value, nil
}

// StringValueCoder implements ValueCoder for string values without JSON encoding
type StringValueCoder struct{}

func (c StringValueCoder) Encode(value string) (string, error) {
	return value, nil
}

func (c StringValueCoder) Decode(encoded string) (string, error) {
	return encoded, nil
}

// RedisCache implements a generic Redis-based cache
type RedisCache[T any] struct {
	client *redis.Client
	prefix string
	coder  ValueCoder[T]
}

// NewCache creates a new RedisCache instance
func NewCache[T any](client *redis.Client, prefix string) *RedisCache[T] {
	return &RedisCache[T]{
		client: client,
		prefix: prefix,
		coder:  JSONValueCoder[T]{},
	}
}

// NewStringCache creates a new RedisCache instance for string values
func NewStringCache(client *redis.Client, prefix string) *RedisCache[string] {
	return &RedisCache[string]{
		client: client,
		prefix: prefix,
		coder:  StringValueCoder{},
	}
}

// WithCoder allows setting a custom value coder
func (c *RedisCache[T]) WithCoder(coder ValueCoder[T]) *RedisCache[T] {
	c.coder = coder
	return c
}

// fullKey returns the full Redis key with prefix
func (c *RedisCache[T]) fullKey(key string) string {
	if c.prefix == "" {
		return key
	}
	return fmt.Sprintf("%s:%s", c.prefix, key)
}

// Set stores a value in the cache
func (c *RedisCache[T]) Set(ctx context.Context, key string, value T) error {
	encoded, err := c.coder.Encode(value)
	if err != nil {
		return err
	}
	return c.client.Set(ctx, c.fullKey(key), encoded, 0).Err()
}

// SetWithExpiration stores a value in the cache with an expiration time
func (c *RedisCache[T]) SetWithExpiration(ctx context.Context, key string, value T, expiration time.Duration) error {
	encoded, err := c.coder.Encode(value)
	if err != nil {
		return err
	}
	return c.client.Set(ctx, c.fullKey(key), encoded, expiration).Err()
}

// Get retrieves a value from the cache
func (c *RedisCache[T]) Get(ctx context.Context, key string) (T, error) {
	var value T
	encoded, err := c.client.Get(ctx, c.fullKey(key)).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return value, redis.Nil
		}
		return value, fmt.Errorf("failed to get value: %w", err)
	}
	return c.coder.Decode(encoded)
}

// Getdel retrieves and deletes a value from the cache
func (c *RedisCache[T]) Getdel(ctx context.Context, key string) (T, error) {
	var value T
	encoded, err := c.client.GetDel(ctx, c.fullKey(key)).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return value, redis.Nil
		}
		return value, fmt.Errorf("failed to get and delete value: %w", err)
	}
	return c.coder.Decode(encoded)
}

// GetWithTTL retrieves a value and its TTL from the cache
func (c *RedisCache[T]) GetWithTTL(ctx context.Context, key string) (T, time.Duration, error) {
	var value T
	encoded, err := c.client.Get(ctx, c.fullKey(key)).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return value, 0, redis.Nil
		}
		return value, 0, fmt.Errorf("failed to get value: %w", err)
	}

	ttl, err := c.client.TTL(ctx, c.fullKey(key)).Result()
	if err != nil {
		return value, 0, fmt.Errorf("failed to get TTL: %w", err)
	}

	decoded, err := c.coder.Decode(encoded)
	if err != nil {
		return value, 0, err
	}

	return decoded, ttl, nil
}

// Delete removes a value from the cache
func (c *RedisCache[T]) Delete(ctx context.Context, key string) error {
	return c.client.Del(ctx, c.fullKey(key)).Err()
}

// DeleteAll removes all values with the cache's prefix
func (c *RedisCache[T]) DeleteAll(ctx context.Context) error {
	if c.prefix == "" {
		return errors.New("cannot delete all keys without a prefix")
	}

	keys, err := c.client.Keys(ctx, c.prefix+":*").Result()
	if err != nil {
		return fmt.Errorf("failed to get keys: %w", err)
	}

	if len(keys) == 0 {
		return nil
	}

	return c.client.Del(ctx, keys...).Err()
}

// Exists checks if a key exists in the cache
func (c *RedisCache[T]) Exists(ctx context.Context, key string) (bool, error) {
	result, err := c.client.Exists(ctx, c.fullKey(key)).Result()
	if err != nil {
		return false, fmt.Errorf("failed to check existence: %w", err)
	}
	return result > 0, nil
}

// Keys returns all keys in the cache with the given prefix
func (c *RedisCache[T]) Keys(ctx context.Context) ([]string, error) {
	pattern := "*"
	if c.prefix != "" {
		pattern = c.prefix + ":*"
	}

	keys, err := c.client.Keys(ctx, pattern).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get keys: %w", err)
	}

	// Remove prefix from keys
	if c.prefix != "" {
		prefixLen := len(c.prefix) + 1 // +1 for the colon
		for i, key := range keys {
			keys[i] = key[prefixLen:]
		}
	}

	return keys, nil
}

// GetAll retrieves all values from the cache
func (c *RedisCache[T]) GetAll(ctx context.Context) (map[string]T, error) {
	keys, err := c.Keys(ctx)
	if err != nil {
		return nil, err
	}

	result := make(map[string]T)
	for _, key := range keys {
		value, err := c.Get(ctx, key)
		if err != nil {
			if errors.Is(err, redis.Nil) {
				continue
			}
			return nil, err
		}
		result[key] = value
	}

	return result, nil
}

// Increment is a helper function to increment numeric values
func Increment[T int | float64](ctx context.Context, cache *RedisCache[T], key string, delta T) (T, error) {
	var result T
	var err error

	switch any(delta).(type) {
	case int:
		cmd := cache.client.IncrBy(ctx, cache.fullKey(key), int64(delta))
		if err = cmd.Err(); err != nil {
			return result, fmt.Errorf("failed to increment: %w", err)
		}
		result = T(cmd.Val())
	case float64:
		cmd := cache.client.IncrByFloat(ctx, cache.fullKey(key), float64(delta))
		if err = cmd.Err(); err != nil {
			return result, fmt.Errorf("failed to increment: %w", err)
		}
		result = T(cmd.Val())
	}

	return result, nil
}
