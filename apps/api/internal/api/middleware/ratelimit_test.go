package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func newLimitedHandler(t *testing.T, limit int, window time.Duration) (http.Handler, *miniredis.Miniredis, *RateLimiter) {
	t.Helper()
	mr := miniredis.RunT(t)
	limiter := NewRateLimiter(redis.NewClient(&redis.Options{Addr: mr.Addr()}))
	handler := limiter.Limit("test", limit, window)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	return handler, mr, limiter
}

func hit(handler http.Handler, addr string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/oauth/token", nil)
	req.RemoteAddr = addr
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestRateLimiterBlocksAfterLimit(t *testing.T) {
	handler, mr, limiter := newLimitedHandler(t, 3, time.Minute)
	start := time.Date(2026, 9, 18, 12, 0, 10, 0, time.UTC)
	limiter.now = func() time.Time { return start }

	for i := 0; i < 3; i++ {
		if rec := hit(handler, "10.0.0.1:1234"); rec.Code != http.StatusNoContent {
			t.Fatalf("request %d: status = %d", i+1, rec.Code)
		}
	}
	rec := hit(handler, "10.0.0.1:9999")
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("fourth request: status = %d", rec.Code)
	}
	if got := rec.Header().Get("Retry-After"); got != "51" {
		t.Fatalf("Retry-After = %q, want seconds left in the window", got)
	}
	if rec := hit(handler, "10.0.0.2:1234"); rec.Code != http.StatusNoContent {
		t.Fatalf("another address must have its own budget, status = %d", rec.Code)
	}

	limiter.now = func() time.Time { return start.Add(time.Minute) }
	mr.FastForward(time.Minute)
	if rec := hit(handler, "10.0.0.1:1234"); rec.Code != http.StatusNoContent {
		t.Fatalf("next window: status = %d", rec.Code)
	}
}

func TestRateLimiterFailsOpenWithoutRedis(t *testing.T) {
	handler, mr, _ := newLimitedHandler(t, 1, time.Minute)
	mr.Close()
	for i := 0; i < 3; i++ {
		if rec := hit(handler, "10.0.0.1:1234"); rec.Code != http.StatusNoContent {
			t.Fatalf("request %d: status = %d", i+1, rec.Code)
		}
	}
}
