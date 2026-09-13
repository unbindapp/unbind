package k8s

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8sfake "k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"
)

func identity(s string) string { return s }

func TestCachedServesSecondReadFromCache(t *testing.T) {
	cache := newTTLCache(time.Minute)
	calls := 0
	fetch := func(context.Context) (string, error) {
		calls++
		return "value", nil
	}

	for range 3 {
		got, err := cached(t.Context(), cache, "key", fetch, identity)
		if err != nil || got != "value" {
			t.Fatalf("cached = (%q, %v)", got, err)
		}
	}

	if calls != 1 {
		t.Fatalf("fetched %d times, want 1", calls)
	}
}

func TestCachedRefetchesAfterTTL(t *testing.T) {
	cache := newTTLCache(10 * time.Millisecond)
	calls := 0
	fetch := func(context.Context) (string, error) {
		calls++
		return "value", nil
	}

	if _, err := cached(t.Context(), cache, "key", fetch, identity); err != nil {
		t.Fatal(err)
	}
	time.Sleep(20 * time.Millisecond)
	if _, err := cached(t.Context(), cache, "key", fetch, identity); err != nil {
		t.Fatal(err)
	}

	if calls != 2 {
		t.Fatalf("fetched %d times, want 2", calls)
	}
}

func TestCachedDisabledWithoutTTL(t *testing.T) {
	cache := newTTLCache(0)
	calls := 0
	fetch := func(context.Context) (string, error) {
		calls++
		return "value", nil
	}

	for range 3 {
		if _, err := cached(t.Context(), cache, "key", fetch, identity); err != nil {
			t.Fatal(err)
		}
	}

	if calls != 3 {
		t.Fatalf("fetched %d times, want every read to reach the cluster", calls)
	}
}

func TestCachedDoesNotCacheFailures(t *testing.T) {
	cache := newTTLCache(time.Minute)
	calls := 0
	fetch := func(context.Context) (string, error) {
		calls++
		if calls == 1 {
			return "", errors.New("cluster unreachable")
		}
		return "value", nil
	}

	if _, err := cached(t.Context(), cache, "key", fetch, identity); err == nil {
		t.Fatal("first read should surface the failure")
	}
	got, err := cached(t.Context(), cache, "key", fetch, identity)
	if err != nil || got != "value" {
		t.Fatalf("second read = (%q, %v), want the retry to succeed", got, err)
	}
}

func TestInvalidateDropsEverything(t *testing.T) {
	cache := newTTLCache(time.Minute)
	calls := 0
	fetch := func(context.Context) (string, error) {
		calls++
		return "value", nil
	}

	if _, err := cached(t.Context(), cache, "key", fetch, identity); err != nil {
		t.Fatal(err)
	}
	cache.invalidate()
	if _, err := cached(t.Context(), cache, "key", fetch, identity); err != nil {
		t.Fatal(err)
	}

	if calls != 2 {
		t.Fatalf("fetched %d times, want the write to have dropped the entry", calls)
	}
}

func TestCachedSurvivesCallerCancellation(t *testing.T) {
	cache := newTTLCache(time.Minute)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	got, err := cached(ctx, cache, "key", func(ctx context.Context) (string, error) {
		if err := ctx.Err(); err != nil {
			return "", err
		}
		return "value", nil
	}, identity)
	if err != nil || got != "value" {
		t.Fatalf("cached = (%q, %v), want the shared fetch to outlive the caller", got, err)
	}
}

func TestCachedCollapsesConcurrentReads(t *testing.T) {
	cache := newTTLCache(time.Minute)
	var calls atomic.Int32
	fetch := func(context.Context) (string, error) {
		calls.Add(1)
		time.Sleep(20 * time.Millisecond)
		return "value", nil
	}

	var wg sync.WaitGroup
	for range 10 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := cached(t.Context(), cache, "key", fetch, identity); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()

	if got := calls.Load(); got != 1 {
		t.Fatalf("fetched %d times, want 10 concurrent readers to share one call", got)
	}
}

func TestCachedHandsOutCopies(t *testing.T) {
	cache := newTTLCache(time.Minute)
	fetch := func(context.Context) (*corev1.PodList, error) {
		return &corev1.PodList{Items: []corev1.Pod{{ObjectMeta: metav1.ObjectMeta{Name: "api-0"}}}}, nil
	}

	first, err := cached(t.Context(), cache, "pods", fetch, (*corev1.PodList).DeepCopy)
	if err != nil {
		t.Fatal(err)
	}
	first.Items[0].Name = "mutated"

	second, err := cached(t.Context(), cache, "pods", fetch, (*corev1.PodList).DeepCopy)
	if err != nil {
		t.Fatal(err)
	}
	if second.Items[0].Name != "api-0" {
		t.Fatalf("name = %q, want one caller's mutation not to reach the next", second.Items[0].Name)
	}
}

func TestGetPodsByLabelsOnlyCachesTheInternalClient(t *testing.T) {
	var listed atomic.Int32
	client := k8sfake.NewSimpleClientset(&corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "api-0", Namespace: "team", Labels: map[string]string{"unbind-service": "abc"}},
	})
	client.PrependReactor("list", "pods", func(k8stesting.Action) (bool, runtime.Object, error) {
		listed.Add(1)
		return false, nil, nil
	})

	kube := &KubeClient{clientset: client, listCache: newTTLCache(time.Minute)}
	labels := map[string]string{"unbind-service": "abc"}

	for range 3 {
		if _, err := kube.GetPodsByLabels(t.Context(), "team", labels, client); err != nil {
			t.Fatal(err)
		}
	}
	if got := listed.Load(); got != 1 {
		t.Fatalf("listed %d times through the internal client, want 1", got)
	}

	other := k8sfake.NewSimpleClientset()
	for range 2 {
		if _, err := kube.GetPodsByLabels(t.Context(), "team", labels, other); err != nil {
			t.Fatal(err)
		}
	}
	if got := listed.Load(); got != 1 {
		t.Fatalf("a user-scoped client was served from the internal client's cache")
	}
}

func TestDetectProviderDoesNotCacheAnUnreachableCluster(t *testing.T) {
	client := k8sfake.NewSimpleClientset()
	failing := true
	client.PrependReactor("list", "ingressclasses", func(k8stesting.Action) (bool, runtime.Object, error) {
		if failing {
			return true, nil, errors.New("cluster unreachable")
		}
		return true, &networkingv1.IngressClassList{
			Items: []networkingv1.IngressClass{{ObjectMeta: metav1.ObjectMeta{Name: providerTraefik}}},
		}, nil
	})

	kube := &KubeClient{clientset: client, clusterCache: newTTLCache(time.Minute)}

	if got := kube.detectProvider(t.Context()); got != providerNginx {
		t.Fatalf("provider = %q, want the nginx fallback while detection fails", got)
	}

	failing = false
	if got := kube.detectProvider(t.Context()); got != providerTraefik {
		t.Fatalf("provider = %q, want detection to run again once the cluster answers", got)
	}
}
