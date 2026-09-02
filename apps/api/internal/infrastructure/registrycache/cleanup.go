package registrycache

import (
	"bytes"
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/unbindapp/unbind-api/internal/common/log"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"
	"k8s.io/streaming/pkg/httpstream"
)

const (
	RegistryContainerName = "registry"
	RegistryPodSelector   = "app=registry"

	registryDataDir    = "/var/lib/registry"
	registryConfigPath = "/etc/distribution/config.yml"
	registryRepoDir    = registryDataDir + "/docker/registry/v2/repositories"
	tagLinkMarker      = "/_manifests/tags/"

	buildCacheSuffix   = "-buildcache"
	staleUploadMinutes = 1440
	manifestIndexDepth = 2
)

type TagInfo struct {
	Repo    string
	Tag     string
	Digest  string
	Blobs   map[string]int64
	ModTime int64
}

func (self TagInfo) Key() string {
	return self.Repo + ":" + self.Tag
}

func (self TagInfo) ManifestKey() string {
	return self.Repo + "@" + self.Digest
}

func (self TagInfo) IsBuildCache() bool {
	return strings.HasSuffix(self.Tag, buildCacheSuffix)
}

type Cleaner struct {
	namespace string
	registry  *Client
	clientset kubernetes.Interface
	restCfg   *rest.Config
}

func NewCleaner(namespace string, restCfg *rest.Config) (*Cleaner, error) {
	clientset, err := kubernetes.NewForConfig(restCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes client: %w", err)
	}
	return &Cleaner{
		namespace: namespace,
		registry:  NewClient(RegistryURL(namespace)),
		clientset: clientset,
		restCfg:   restCfg,
	}, nil
}

func (self *Cleaner) Run(ctx context.Context, thresholdBytes int64) error {
	pod, err := self.registryPod(ctx)
	if err != nil {
		return err
	}

	if err := self.pruneStaleUploads(ctx, pod); err != nil {
		log.Warnf("registry cleanup: failed to prune stale uploads: %v", err)
	}

	used, err := self.diskUsage(ctx, pod)
	if err != nil {
		return err
	}

	log.Infof("registry cleanup: %s used, threshold %s", humanBytes(used), humanBytes(thresholdBytes))
	if used < thresholdBytes {
		return nil
	}

	tags, err := self.inventory(ctx, pod)
	if err != nil {
		return err
	}

	inUse, err := self.inUseRefs(ctx)
	if err != nil {
		return fmt.Errorf("refusing to prune without the list of deployed images: %w", err)
	}

	plan := planDeletions(tags, inUse, used-thresholdBytes)
	if len(plan) == 0 {
		log.Warnf("registry cleanup: over threshold with nothing prunable, grow the registry volume")
	}

	for _, tag := range plan {
		if err := self.registry.DeleteManifest(ctx, tag.Repo, tag.Digest); err != nil {
			log.Warnf("registry cleanup: failed to delete %s: %v", tag.Key(), err)
			continue
		}
		log.Infof("registry cleanup: deleted %s", tag.Key())
	}

	return self.garbageCollect(ctx, pod)
}

func planDeletions(tags []TagInfo, inUse map[string]bool, target int64) []TagInfo {
	if target <= 0 {
		return nil
	}

	protected := protectedTags(tags, inUse)
	protectedManifests := map[string]bool{}
	blobRefs := map[string]int{}
	counted := map[string]bool{}
	candidates := make([]TagInfo, 0, len(tags))
	for _, tag := range tags {
		if !counted[tag.ManifestKey()] {
			counted[tag.ManifestKey()] = true
			for digest := range tag.Blobs {
				blobRefs[digest]++
			}
		}
		if protected[tag.Key()] {
			protectedManifests[tag.ManifestKey()] = true
			continue
		}
		candidates = append(candidates, tag)
	}

	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].IsBuildCache() != candidates[j].IsBuildCache() {
			return candidates[i].IsBuildCache()
		}
		return candidates[i].ModTime < candidates[j].ModTime
	})

	var plan []TagInfo
	var freed int64
	planned := map[string]bool{}
	for _, tag := range candidates {
		if freed >= target {
			break
		}
		// Deletion is by digest, so a manifest a protected tag also points at is off limits
		if tag.Digest == "" || protectedManifests[tag.ManifestKey()] || planned[tag.ManifestKey()] {
			continue
		}
		planned[tag.ManifestKey()] = true
		for digest, size := range tag.Blobs {
			blobRefs[digest]--
			if blobRefs[digest] == 0 {
				freed += size
			}
		}
		plan = append(plan, tag)
	}
	return plan
}

func protectedTags(tags []TagInfo, inUse map[string]bool) map[string]bool {
	protected := map[string]bool{}
	newest := map[string]TagInfo{}

	for _, tag := range tags {
		if inUse[tag.Key()] || inUse[tag.Repo+":"+tag.Digest] {
			protected[tag.Key()] = true
		}
		if tag.IsBuildCache() {
			continue
		}
		if current, ok := newest[tag.Repo]; !ok || tag.ModTime > current.ModTime {
			newest[tag.Repo] = tag
		}
	}

	for _, tag := range newest {
		protected[tag.Key()] = true
	}
	return protected
}

func (self *Cleaner) inventory(ctx context.Context, pod string) ([]TagInfo, error) {
	repos, err := self.registry.Repositories(ctx)
	if err != nil {
		return nil, err
	}

	modTimes, err := self.tagModTimes(ctx, pod)
	if err != nil {
		log.Warnf("registry cleanup: failed to read tag timestamps, falling back to unordered pruning: %v", err)
		modTimes = map[string]int64{}
	}

	var inventory []TagInfo
	for _, repo := range repos {
		tags, err := self.registry.Tags(ctx, repo)
		if err != nil {
			log.Warnf("registry cleanup: failed to list tags for %s: %v", repo, err)
			continue
		}
		for _, tag := range tags {
			manifest, err := self.registry.Manifest(ctx, repo, tag)
			if err != nil {
				log.Warnf("registry cleanup: failed to read manifest %s:%s: %v", repo, tag, err)
				continue
			}
			blobs := map[string]int64{}
			if err := collectBlobs(ctx, self.registry, repo, tag, blobs, 0); err != nil {
				log.Warnf("registry cleanup: failed to size %s:%s: %v", repo, tag, err)
				continue
			}
			inventory = append(inventory, TagInfo{
				Repo:    repo,
				Tag:     tag,
				Digest:  manifest.Digest,
				Blobs:   blobs,
				ModTime: modTimes[repo+":"+tag],
			})
		}
	}
	return inventory, nil
}

func (self *Cleaner) inUseRefs(ctx context.Context) (map[string]bool, error) {
	pods, err := self.clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	refs := map[string]bool{}
	add := func(image string) {
		if key, ok := imageRefKey(image); ok {
			refs[key] = true
		}
	}

	for _, pod := range pods.Items {
		for _, container := range pod.Spec.InitContainers {
			add(container.Image)
		}
		for _, container := range pod.Spec.Containers {
			add(container.Image)
		}
		for _, status := range pod.Status.ContainerStatuses {
			add(status.Image)
		}
	}
	return refs, nil
}

func imageRefKey(image string) (string, bool) {
	if image == "" {
		return "", false
	}

	name := image
	ref := "latest"
	if at := strings.Index(name, "@"); at >= 0 {
		ref = name[at+1:]
		name = name[:at]
	} else if colon := strings.LastIndex(name, ":"); colon > strings.LastIndex(name, "/") {
		ref = name[colon+1:]
		name = name[:colon]
	}

	if slash := strings.Index(name, "/"); slash > 0 {
		host := name[:slash]
		if strings.ContainsAny(host, ".:") || host == "localhost" {
			name = name[slash+1:]
		}
	}

	if name == "" {
		return "", false
	}
	return name + ":" + ref, true
}

func (self *Cleaner) registryPod(ctx context.Context) (string, error) {
	pods, err := self.clientset.CoreV1().Pods(self.namespace).List(ctx, metav1.ListOptions{LabelSelector: RegistryPodSelector})
	if err != nil {
		return "", err
	}
	for _, pod := range pods.Items {
		if pod.Status.Phase == corev1.PodRunning {
			return pod.Name, nil
		}
	}
	return "", fmt.Errorf("no running registry pod found in %s", self.namespace)
}

func (self *Cleaner) diskUsage(ctx context.Context, pod string) (int64, error) {
	out, err := self.exec(ctx, pod, []string{"du", "-sk", registryDataDir})
	if err != nil {
		return 0, fmt.Errorf("failed to measure registry usage: %w", err)
	}
	return parseDiskUsage(out)
}

func parseDiskUsage(output string) (int64, error) {
	fields := strings.Fields(strings.TrimSpace(output))
	if len(fields) == 0 {
		return 0, fmt.Errorf("empty du output")
	}
	kb, err := strconv.ParseInt(fields[0], 10, 64)
	if err != nil {
		return 0, fmt.Errorf("unexpected du output %q: %w", output, err)
	}
	return kb * 1024, nil
}

// Tags are content hashes with no ordering, so the tag link mtime stands in for push time
func (self *Cleaner) tagModTimes(ctx context.Context, pod string) (map[string]int64, error) {
	command := fmt.Sprintf(`find %s -path '*/_manifests/tags/*/current/link' -exec stat -c '%%Y %%n' {} +`, registryRepoDir)
	out, err := self.exec(ctx, pod, []string{"sh", "-c", command})
	if err != nil {
		return nil, err
	}
	return parseTagModTimes(out), nil
}

func parseTagModTimes(output string) map[string]int64 {
	modTimes := map[string]int64{}
	for line := range strings.SplitSeq(output, "\n") {
		fields := strings.SplitN(strings.TrimSpace(line), " ", 2)
		if len(fields) != 2 {
			continue
		}
		epoch, err := strconv.ParseInt(fields[0], 10, 64)
		if err != nil {
			continue
		}
		key, ok := tagKeyFromLinkPath(fields[1])
		if !ok {
			continue
		}
		modTimes[key] = epoch
	}
	return modTimes
}

func tagKeyFromLinkPath(path string) (string, bool) {
	trimmed := strings.TrimPrefix(path, registryRepoDir+"/")
	if trimmed == path {
		return "", false
	}
	repo, rest, found := strings.Cut(trimmed, tagLinkMarker)
	if !found {
		return "", false
	}
	tag, _, found := strings.Cut(rest, "/")
	if !found || repo == "" || tag == "" {
		return "", false
	}
	return repo + ":" + tag, true
}

// Distribution's own purger only drops uploads older than 7 days, too slow for a full volume
func (self *Cleaner) pruneStaleUploads(ctx context.Context, pod string) error {
	command := fmt.Sprintf(
		`for d in $(find %s -type d -name _uploads); do find "$d" -mindepth 1 -maxdepth 1 -mmin +%d -exec rm -rf {} +; done`,
		registryRepoDir, staleUploadMinutes,
	)
	_, err := self.exec(ctx, pod, []string{"sh", "-c", command})
	return err
}

func (self *Cleaner) garbageCollect(ctx context.Context, pod string) error {
	if _, err := self.exec(ctx, pod, []string{"/bin/registry", "garbage-collect", registryConfigPath, "--delete-untagged=true"}); err != nil {
		return fmt.Errorf("garbage collection failed: %w", err)
	}
	log.Infof("registry cleanup: garbage collection finished")
	return nil
}

func (self *Cleaner) exec(ctx context.Context, pod string, command []string) (string, error) {
	req := self.clientset.CoreV1().RESTClient().
		Post().
		Resource("pods").
		Name(pod).
		Namespace(self.namespace).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: RegistryContainerName,
			Command:   command,
			Stdout:    true,
			Stderr:    true,
		}, scheme.ParameterCodec)

	wsExec, err := remotecommand.NewWebSocketExecutor(self.restCfg, "GET", req.URL().String())
	if err != nil {
		return "", err
	}
	spdyExec, err := remotecommand.NewSPDYExecutor(self.restCfg, "POST", req.URL())
	if err != nil {
		return "", err
	}
	executor, err := remotecommand.NewFallbackExecutor(wsExec, spdyExec, httpstream.IsUpgradeFailure)
	if err != nil {
		return "", err
	}

	var stdout, stderr bytes.Buffer
	if err := executor.StreamWithContext(ctx, remotecommand.StreamOptions{Stdout: &stdout, Stderr: &stderr}); err != nil {
		return stdout.String(), fmt.Errorf("%w: %s", err, strings.TrimSpace(stderr.String()))
	}
	return stdout.String(), nil
}

func humanBytes(b int64) string {
	return resource.NewQuantity(b, resource.BinarySI).String()
}
