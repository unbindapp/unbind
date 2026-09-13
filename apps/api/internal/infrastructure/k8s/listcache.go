package k8s

import (
	"context"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
	"k8s.io/client-go/kubernetes"
)

const (
	// clusterFactTTL covers facts that only change when someone installs or
	// removes a controller, so they are re-read on a human timescale.
	clusterFactTTL = 5 * time.Minute
	// cacheFetchTimeout bounds a fetch that outlives the caller that started it.
	cacheFetchTimeout = 15 * time.Second
)

// ttlCache collapses repeated reads of the same cluster state into one call. The
// UI polls several endpoints every few seconds per open tab, so without it the
// read load grows with tabs and users rather than with what is deployed.
//
// It is deliberately narrow, because a cache that guesses is worse than no cache:
//   - reads only, and only through the shared internal client (a user-scoped
//     client always goes to the API server, so nothing can be served across
//     permission boundaries)
//   - values are copied in and out, so no caller sees another's mutations
//   - every write this process makes drops the whole cache, so an action taken in
//     the UI is never followed by a stale read
//   - a TTL of zero disables it entirely (KUBERNETES_LIST_CACHE_TTL=0)
type ttlCache struct {
	ttl     time.Duration
	mu      sync.Mutex
	entries map[string]cacheEntry
	group   singleflight.Group
}

type cacheEntry struct {
	value   any
	expires time.Time
}

func newTTLCache(ttl time.Duration) *ttlCache {
	return &ttlCache{ttl: ttl, entries: make(map[string]cacheEntry)}
}

func (self *ttlCache) enabled() bool {
	return self != nil && self.ttl > 0
}

func (self *ttlCache) load(key string) (any, bool) {
	if !self.enabled() {
		return nil, false
	}

	self.mu.Lock()
	defer self.mu.Unlock()

	entry, ok := self.entries[key]
	if !ok || time.Now().After(entry.expires) {
		return nil, false
	}
	return entry.value, true
}

func (self *ttlCache) store(key string, value any) {
	if !self.enabled() {
		return
	}

	self.mu.Lock()
	defer self.mu.Unlock()

	now := time.Now()
	for k, entry := range self.entries {
		if now.After(entry.expires) {
			delete(self.entries, k)
		}
	}
	self.entries[key] = cacheEntry{value: value, expires: now.Add(self.ttl)}
}

// invalidate drops everything. Called after any write this process makes: the
// blast radius of re-reading a few lists is a couple of API calls, while the
// blast radius of serving state we just changed is a user filing a bug.
func (self *ttlCache) invalidate() {
	if self == nil {
		return
	}

	self.mu.Lock()
	defer self.mu.Unlock()

	clear(self.entries)
}

// cached returns the value for key, running fetch at most once across all callers
// waiting on it. copy hands every caller its own value.
func cached[T any](ctx context.Context, cache *ttlCache, key string, fetch func(context.Context) (T, error), copy func(T) T) (T, error) {
	if !cache.enabled() {
		return fetch(ctx)
	}

	if value, ok := cache.load(key); ok {
		if typed, ok := value.(T); ok {
			return copy(typed), nil
		}
	}

	value, err, _ := cache.group.Do(key, func() (any, error) {
		// The fetch is shared, so it must not die with whichever caller happened
		// to trigger it: a browser navigating away would otherwise fail the
		// requests queued behind it.
		fetchCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), cacheFetchTimeout)
		defer cancel()

		fetched, err := fetch(fetchCtx)
		if err != nil {
			return nil, err
		}
		cache.store(key, fetched)
		return fetched, nil
	})
	if err != nil {
		var zero T
		return zero, err
	}

	typed, ok := value.(T)
	if !ok {
		return fetch(ctx)
	}
	return copy(typed), nil
}

// cacheable reports whether a read may be served from cache. Only the shared
// internal client qualifies: a user-scoped client sees what its own permissions
// allow, and that is never safe to hand to the next caller.
func (self *KubeClient) cacheable(client kubernetes.Interface) bool {
	return client != nil && self.clientset != nil && client == self.clientset
}

// invalidateCache is called by the write paths so a read that follows a change
// this process made never sees the state from before it.
func (self *KubeClient) invalidateCache() {
	self.listCache.invalidate()
}
