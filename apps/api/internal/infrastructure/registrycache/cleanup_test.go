package registrycache

import (
	"context"
	"math"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/internal/models"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sfake "k8s.io/client-go/kubernetes/fake"
)

const (
	noFreshTags = int64(math.MaxInt64)
	gib         = int64(1 << 30)
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
	assert.Empty(t, planDeletions(tags, nil, 0, noFreshTags))
	assert.Empty(t, planDeletions(tags, nil, -50, noFreshTags))
}

func TestPlanDeletionsOldestFirst(t *testing.T) {
	tags := []TagInfo{
		tag("app", "newest", 300, map[string]int64{"n": 100}),
		tag("app", "middle", 200, map[string]int64{"m": 100}),
		tag("app", "oldest", 100, map[string]int64{"o": 100}),
		tag("app", "stale-buildcache", 150, map[string]int64{"s": 100}),
		tag("app", "current-buildcache", 250, map[string]int64{"c": 100}),
	}

	plan := planDeletions(tags, nil, 300, noFreshTags)

	assert.Equal(t, []string{"app:oldest", "app:stale-buildcache", "app:middle"}, keys(plan))
}

func TestPlanDeletionsKeepsNewestBuildCachePerRepository(t *testing.T) {
	tags := []TagInfo{
		tag("one", "image", 50, map[string]int64{"i1": 100}),
		tag("one", "new-buildcache", 200, map[string]int64{"a": 100}),
		tag("one", "old-buildcache", 100, map[string]int64{"b": 100}),
		tag("two", "image", 50, map[string]int64{"i2": 100}),
		tag("two", "only-buildcache", 10, map[string]int64{"c": 100}),
	}

	plan := planDeletions(tags, nil, 10000, noFreshTags)

	assert.Equal(t, []string{"one:old-buildcache"}, keys(plan))
}

func TestPlanDeletionsProtectsRunningImages(t *testing.T) {
	tags := []TagInfo{
		tag("app", "newest", 300, map[string]int64{"n": 100}),
		tag("app", "running", 200, map[string]int64{"r": 100}),
		tag("app", "stale", 100, map[string]int64{"s": 100}),
	}
	inUse := map[string]bool{"app:running": true}

	plan := planDeletions(tags, inUse, 1000, noFreshTags)

	assert.Equal(t, []string{"app:stale"}, keys(plan))
}

func TestPlanDeletionsProtectsDigestPinnedImages(t *testing.T) {
	pinned := tag("app", "stale", 100, map[string]int64{"s": 100})
	tags := []TagInfo{
		tag("app", "newest", 300, map[string]int64{"n": 100}),
		pinned,
	}
	inUse := map[string]bool{"app:" + pinned.Digest: true}

	assert.Empty(t, planDeletions(tags, inUse, 1000, noFreshTags))
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

	assert.Empty(t, planDeletions(tags, inUse, 1000, noFreshTags))
}

func TestOrphanedChildren(t *testing.T) {
	deleted := TagInfo{Repo: "app", Tag: "old", Digest: "sha256:old", Children: []string{"sha256:image", "sha256:attestation", "sha256:shared"}}
	alias := TagInfo{Repo: "app", Tag: "alias", Digest: "sha256:old", Children: deleted.Children}
	kept := TagInfo{Repo: "app", Tag: "new", Digest: "sha256:new", Children: []string{"sha256:shared"}}
	otherRepo := TagInfo{Repo: "web", Tag: "new", Digest: "sha256:web", Children: []string{"sha256:image"}}
	tags := []TagInfo{deleted, alias, kept, otherRepo}

	assert.Equal(t,
		[]manifestRef{{repo: "app", digest: "sha256:image"}, {repo: "app", digest: "sha256:attestation"}},
		orphanedChildren(tags, []TagInfo{deleted}),
		"a kept index keeps its children, and an alias of the deleted digest goes with it",
	)
	assert.Empty(t, orphanedChildren(tags, nil))
}

func TestPlanDeletionsOnlyCountsBlobsNoSurvivorNeeds(t *testing.T) {
	tags := []TagInfo{
		tag("app", "newest", 300, map[string]int64{"base": 900, "top-new": 100}),
		tag("app", "old-a", 200, map[string]int64{"base": 900, "top-a": 100}),
		tag("app", "old-b", 100, map[string]int64{"base": 900, "top-b": 100}),
	}

	plan := planDeletions(tags, nil, 150, noFreshTags)

	assert.Equal(t, []string{"app:old-b", "app:old-a"}, keys(plan))
}

func TestPlanDeletionsStopsAtTarget(t *testing.T) {
	tags := []TagInfo{
		tag("app", "newest", 400, map[string]int64{"n": 100}),
		tag("app", "a", 300, map[string]int64{"a": 100}),
		tag("app", "b", 200, map[string]int64{"b": 100}),
		tag("app", "c", 100, map[string]int64{"c": 100}),
	}

	plan := planDeletions(tags, nil, 100, noFreshTags)

	assert.Equal(t, []string{"app:c"}, keys(plan))
}

func TestPlanDeletionsKeepsNewestPerRepository(t *testing.T) {
	tags := []TagInfo{
		tag("one", "new", 200, map[string]int64{"a": 100}),
		tag("one", "old", 100, map[string]int64{"b": 100}),
		tag("two", "new", 200, map[string]int64{"c": 100}),
		tag("two", "old", 100, map[string]int64{"d": 100}),
	}

	plan := planDeletions(tags, nil, 10000, noFreshTags)

	assert.ElementsMatch(t, []string{"one:old", "two:old"}, keys(plan))
}

func TestPlanDeletionsProtectsFreshTags(t *testing.T) {
	tags := []TagInfo{
		tag("app", "newest", 300, map[string]int64{"n": 100}),
		tag("app", "just-pushed", 250, map[string]int64{"j": 100}),
		tag("app", "old", 100, map[string]int64{"o": 100}),
	}

	plan := planDeletions(tags, nil, 1000, 200)

	assert.Equal(t, []string{"app:old"}, keys(plan))
}

func buildJob(name string, conditions ...batchv1.JobConditionType) *batchv1.Job {
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "unbind-system", Labels: map[string]string{"unbind-deployment-job": "true"}},
	}
	for _, condition := range conditions {
		job.Status.Conditions = append(job.Status.Conditions, batchv1.JobCondition{Type: condition, Status: corev1.ConditionTrue})
	}
	return job
}

func TestWaitForBuildsReturnsWhenNoBuildRuns(t *testing.T) {
	otherJob := &batchv1.Job{ObjectMeta: metav1.ObjectMeta{Name: "other", Namespace: "unbind-system"}}
	clientset := k8sfake.NewClientset(buildJob("done", batchv1.JobComplete), buildJob("failed", batchv1.JobFailed), otherJob)
	cleaner := &Cleaner{namespace: "unbind-system", clientset: clientset}

	assert.NoError(t, cleaner.waitForBuilds(context.Background(), time.Second))
}

func TestWaitForBuildsGivesUpWhileBuildRuns(t *testing.T) {
	cleaner := &Cleaner{namespace: "unbind-system", clientset: k8sfake.NewClientset(buildJob("just-created"))}

	assert.Error(t, cleaner.waitForBuilds(context.Background(), 50*time.Millisecond))
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

func TestPlanDeletionsPruneAllKeepsProtectedTags(t *testing.T) {
	tags := []TagInfo{
		tag("app", "oldest", 100, map[string]int64{"o": 100}),
		tag("app", "deployed", 150, map[string]int64{"d": 100}),
		tag("app", "middle", 200, map[string]int64{"m": 100}),
		tag("app", "newest", 300, map[string]int64{"n": 100}),
	}

	plan := planDeletions(tags, map[string]bool{"app:deployed": true}, math.MaxInt64, noFreshTags)

	assert.Equal(t, []string{"app:oldest", "app:middle"}, keys(plan))
}

func TestCleanupResultOutcome(t *testing.T) {
	cleaned := cleanupResult(20*gib, 10*gib, 16*gib, 4)
	assert.Equal(t, models.RegistryCleanupCleaned, cleaned.Outcome)
	assert.Equal(t, 10*gib, cleaned.FreedBytes)
	assert.Equal(t, 4, cleaned.DeletedImages)

	stuck := cleanupResult(20*gib, 20*gib, 16*gib, 0)
	assert.Equal(t, models.RegistryCleanupOverThreshold, stuck.Outcome)
	assert.Zero(t, stuck.FreedBytes)

	grew := cleanupResult(10*gib, 11*gib, 16*gib, 0)
	assert.Zero(t, grew.FreedBytes)
}

func cleanupJob(name string, created int64, finished bool) batchv1.Job {
	job := batchv1.Job{ObjectMeta: metav1.ObjectMeta{
		Name:              name,
		CreationTimestamp: metav1.Unix(created, 0),
		OwnerReferences:   []metav1.OwnerReference{{Kind: "CronJob", Name: CleanupCronJobName}},
	}}
	if finished {
		job.Status.Conditions = []batchv1.JobCondition{{Type: batchv1.JobComplete, Status: corev1.ConditionTrue}}
	}
	return job
}

func TestHasOlderCleanup(t *testing.T) {
	now := time.Unix(1000, 0)
	scheduled := cleanupJob("registry-cleanup-100", 100, false)
	manual := cleanupJob("registry-cleanup-manual-abc", 200, false)
	finished := cleanupJob("registry-cleanup-50", 50, true)
	build := batchv1.Job{ObjectMeta: metav1.ObjectMeta{Name: "build", CreationTimestamp: metav1.Unix(10, 0)}}

	jobs := []batchv1.Job{scheduled, manual, finished, build}
	assert.False(t, hasOlderCleanup(jobs, scheduled.Name, now))
	assert.True(t, hasOlderCleanup(jobs, manual.Name, now))
	assert.True(t, hasOlderCleanup(jobs, "", now), "outside a job every running cleanup is older")
	assert.False(t, hasOlderCleanup([]batchv1.Job{finished, build}, "", now))

	sameSecondA := cleanupJob("registry-cleanup-manual-a", 300, false)
	sameSecondB := cleanupJob("registry-cleanup-manual-b", 300, false)
	pair := []batchv1.Job{sameSecondA, sameSecondB}
	assert.False(t, hasOlderCleanup(pair, sameSecondA.Name, now))
	assert.True(t, hasOlderCleanup(pair, sameSecondB.Name, now))

	stuck := cleanupJob("registry-cleanup-stuck", 100, false)
	assert.False(t, hasOlderCleanup([]batchv1.Job{stuck, manual}, manual.Name, now.Add(2*time.Hour)), "a job past the deadline never ran")
}
