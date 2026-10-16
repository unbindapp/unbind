package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/redis/go-redis/v9"
	"github.com/unbindapp/unbind-api/internal/common/log"
)

// RateLimiter counts requests per client address in fixed windows shared
// across API replicas. Redis failures let requests through: the endpoints it
// guards have their own backstops, and refusing everyone would be worse.
const (
	loginPerMinute           = 20
	loginPerAccountPerMinute = 10
)

type RateLimiter struct {
	client *redis.Client
	now    func() time.Time
}

func NewRateLimiter(client *redis.Client) *RateLimiter {
	return &RateLimiter{client: client, now: time.Now}
}

// Allow counts one request against key and reports whether it stays within
// limit for the current window, with the seconds until the window resets.
func (self *RateLimiter) Allow(ctx context.Context, key string, limit int, window time.Duration) (bool, int) {
	now := self.now()
	windowStart := now.Truncate(window)
	pipe := self.client.TxPipeline()
	count := pipe.Incr(ctx, fmt.Sprintf("ratelimit:%s:%d", key, windowStart.Unix()))
	pipe.Expire(ctx, fmt.Sprintf("ratelimit:%s:%d", key, windowStart.Unix()), window)
	if _, err := pipe.Exec(ctx); err != nil {
		log.Warnf("ratelimit: %v", err)
		return true, 0
	}
	if count.Val() <= int64(limit) {
		return true, 0
	}
	return false, int(windowStart.Add(window).Sub(now).Seconds()) + 1
}

func (self *RateLimiter) Limit(name string, limit int, window time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			allowed, retryAfter := self.Allow(r.Context(), name+":"+clientAddress(r.RemoteAddr), limit, window)
			if allowed {
				next.ServeHTTP(w, r)
				return
			}
			w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error":             "rate_limited",
				"error_description": "too many requests, try again later",
			})
		})
	}
}

// LoginLimit slows password guessing from one address; the login handler also
// limits attempts per account
func (self *RateLimiter) LoginLimit(api huma.API) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		allowed, retryAfter := self.Allow(ctx.Context(), "login:"+clientAddress(ctx.RemoteAddr()), loginPerMinute, time.Minute)
		if allowed {
			next(ctx)
			return
		}
		ctx.SetHeader("Retry-After", strconv.Itoa(retryAfter))
		_ = huma.WriteErr(api, ctx, http.StatusTooManyRequests, "Too many login attempts, try again later")
	}
}

// AllowLogin limits attempts against one account across addresses
func (self *RateLimiter) AllowLogin(ctx context.Context, email string) (bool, int) {
	return self.Allow(ctx, "login:account:"+strings.ToLower(email), loginPerAccountPerMinute, time.Minute)
}

func clientAddress(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		return remoteAddr
	}
	return host
}
