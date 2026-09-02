package registrycache

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sfake "k8s.io/client-go/kubernetes/fake"
)

func tag(repo, name string, modTime int64, blobs map[string]int64) TagInfo {
	return TagInfo{
		Repo:    repo,
		Tag:     name,
		Digest:  "sha256:" + repo + "-" + name,
		Blobs:   blobs,
		ModTime: modTime,
	}
}

func keys(tags []TagInfo) []string {
	out := make([]string, 0, len(tags))
	for _, t := range tags {
		out = append(out, t.Key())
	}
	return out
}

func TestPlanDeletionsUnderThreshold(t *testing.T) {
	tags := []TagInfo{tag("app", "old", 1, map[string]int64{"a": 100})}
	assert.Empty(t, planDeletions(tags, nil, 0))
	assert.Empty(t, planDeletions(tags, nil, -50))
}

func TestPlanDeletionsPrefersBuildCacheThenOldest(t *testing.T) {
	tags := []TagInfo{
		tag("app", "newest", 300, map[string]int64{"n": 100}),
		tag("app", "middle", 200, map[string]int64{"m": 100}),
		tag("app", "oldest", 100, map[string]int64{"o": 100}),
		tag("app", "cfg-buildcache", 250, map[string]int64{"c": 100}),
	}

	plan := planDeletions(tags, nil, 300)

	assert.Equal(t, []string{"app:cfg-buildcache", "app:oldest", "app:middle"}, keys(plan))
}

func TestPlanDeletionsProtectsRunningImages(t *testing.T) {
	tags := []TagInfo{
		tag("app", "newest", 300, map[string]int64{"n": 100}),
		tag("app", "running", 200, map[string]int64{"r": 100}),
		tag("app", "stale", 100, map[string]int64{"s": 100}),
	}
	inUse := map[string]bool{"app:running": true}

	plan := planDeletions(tags, inUse, 1000)

	assert.Equal(t, []string{"app:stale"}, keys(plan))
}

func TestPlanDeletionsProtectsDigestPinnedImages(t *testing.T) {
	pinned := tag("app", "stale", 100, map[string]int64{"s": 100})
	tags := []TagInfo{
		tag("app", "newest", 300, map[string]int64{"n": 100}),
		pinned,
	}
	inUse := map[string]bool{"app:" + pinned.Digest: true}

	assert.Empty(t, planDeletions(tags, inUse, 1000))
}

func TestPlanDeletionsKeepsDigestSharedWithProtectedTag(t *testing.T) {
	shared := map[string]int64{"s": 100}
	running := TagInfo{Repo: "app", Tag: "running", Digest: "sha256:same", Blobs: shared, ModTime: 200}
	alias := TagInfo{Repo: "app", Tag: "alias", Digest: "sha256:same", Blobs: shared, ModTime: 100}
	tags := []TagInfo{
		tag("app", "newest", 300, map[string]int64{"n": 100}),
		running,
		alias,
	}
	inUse := map[string]bool{"app:running": true}

	assert.Empty(t, planDeletions(tags, inUse, 1000))
}

func TestPlanDeletionsOnlyCountsBlobsNoSurvivorNeeds(t *testing.T) {
	tags := []TagInfo{
		tag("app", "newest", 300, map[string]int64{"base": 900, "top-new": 100}),
		tag("app", "old-a", 200, map[string]int64{"base": 900, "top-a": 100}),
		tag("app", "old-b", 100, map[string]int64{"base": 900, "top-b": 100}),
	}

	plan := planDeletions(tags, nil, 150)

	assert.Equal(t, []string{"app:old-b", "app:old-a"}, keys(plan))
}

func TestPlanDeletionsStopsAtTarget(t *testing.T) {
	tags := []TagInfo{
		tag("app", "newest", 400, map[string]int64{"n": 100}),
		tag("app", "a", 300, map[string]int64{"a": 100}),
		tag("app", "b", 200, map[string]int64{"b": 100}),
		tag("app", "c", 100, map[string]int64{"c": 100}),
	}

	plan := planDeletions(tags, nil, 100)

	assert.Equal(t, []string{"app:c"}, keys(plan))
}

func TestPlanDeletionsKeepsNewestPerRepository(t *testing.T) {
	tags := []TagInfo{
		tag("one", "new", 200, map[string]int64{"a": 100}),
		tag("one", "old", 100, map[string]int64{"b": 100}),
		tag("two", "new", 200, map[string]int64{"c": 100}),
		tag("two", "old", 100, map[string]int64{"d": 100}),
	}

	plan := planDeletions(tags, nil, 10000)

	assert.ElementsMatch(t, []string{"one:old", "two:old"}, keys(plan))
}

func TestImageRefKey(t *testing.T) {
	cases := []struct {
		image string
		want  string
		ok    bool
	}{
		{"docker-registry.unbind-system:5000/tezara:e04be9ca4d24-366ed82277ca", "tezara:e04be9ca4d24-366ed82277ca", true},
		{"docker-registry.unbind-system:5000/group/sub:latest", "group/sub:latest", true},
		{"tezara:abc", "tezara:abc", true},
		{"tezara", "tezara:latest", true},
		{"docker-registry.unbind-system:5000/tezara@sha256:deadbeef", "tezara:sha256:deadbeef", true},
		{"library/redis:7", "library/redis:7", true},
		{"", "", false},
	}

	for _, c := range cases {
		got, ok := imageRefKey(c.image)
		assert.Equal(t, c.ok, ok, c.image)
		if c.ok {
			assert.Equal(t, c.want, got, c.image)
		}
	}
}

func TestParseTagModTimes(t *testing.T) {
	output := `1788280993 /var/lib/registry/docker/registry/v2/repositories/group/sub/_manifests/tags/latest/current/link
1788280994 /var/lib/registry/docker/registry/v2/repositories/tezara/_manifests/tags/e04be9ca4d24-366ed82277ca/current/link
garbage line
1788280995 /elsewhere/link
`

	got := parseTagModTimes(output)

	assert.Equal(t, map[string]int64{
		"group/sub:latest":                 1788280993,
		"tezara:e04be9ca4d24-366ed82277ca": 1788280994,
	}, got)
}

func TestParseDiskUsage(t *testing.T) {
	bytes, err := parseDiskUsage("4194304\t/var/lib/registry\n")
	require.NoError(t, err)
	assert.Equal(t, int64(4194304)*1024, bytes)

	_, err = parseDiskUsage("")
	assert.Error(t, err)

	_, err = parseDiskUsage("du: cannot read\n")
	assert.Error(t, err)
}

func TestInUseRefsCollectsEveryContainer(t *testing.T) {
	pods := &corev1.PodList{Items: []corev1.Pod{
		{
			ObjectMeta: metav1.ObjectMeta{Name: "web", Namespace: "team"},
			Spec: corev1.PodSpec{
				InitContainers: []corev1.Container{{Image: "docker-registry.unbind-system:5000/tezara:init-tag"}},
				Containers:     []corev1.Container{{Image: "docker-registry.unbind-system:5000/tezara:main-tag"}},
			},
			Status: corev1.PodStatus{
				ContainerStatuses: []corev1.ContainerStatus{{Image: "docker-registry.unbind-system:5000/tezara:status-tag"}},
			},
		},
	}}
	cleaner := &Cleaner{namespace: "unbind-system", clientset: k8sfake.NewClientset(pods)}

	refs, err := cleaner.inUseRefs(context.Background())
	require.NoError(t, err)

	assert.True(t, refs["tezara:init-tag"])
	assert.True(t, refs["tezara:main-tag"])
	assert.True(t, refs["tezara:status-tag"])
}
