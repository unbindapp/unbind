package middleware

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

// RateLimiter counts requests per client address in fixed windows shared
// across API replicas. Redis failures let requests through: the endpoints it
// guards have their own backstops, and refusing everyone would be worse.
type RateLimiter struct {
	client *redis.Client
	now    func() time.Time
}

func NewRateLimiter(client *redis.Client) *RateLimiter {
	return &RateLimiter{client: client, now: time.Now}
}

func (self *RateLimiter) Limit(name string, limit int, window time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			now := self.now()
			windowStart := now.Truncate(window)
			key := fmt.Sprintf("ratelimit:%s:%s:%d", name, clientAddress(r), windowStart.Unix())

			pipe := self.client.TxPipeline()
			count := pipe.Incr(r.Context(), key)
			pipe.Expire(r.Context(), key, window)
			if _, err := pipe.Exec(r.Context()); err != nil {
				log.Warnf("ratelimit: %v", err)
				next.ServeHTTP(w, r)
				return
			}
			if count.Val() > int64(limit) {
				retryAfter := windowStart.Add(window).Sub(now).Seconds()
				w.Header().Set("Retry-After", strconv.Itoa(int(retryAfter)+1))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error":             "rate_limited",
					"error_description": "too many requests, try again later",
				})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func clientAddress(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
