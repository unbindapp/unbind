package builders

import (
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/unbindapp/unbind-api/pkg/builder/config"
)

func testBuilder() *Builder {
	return NewBuilder(&config.Config{
		ContainerRegistryHost: "registry.unbind.app",
		ContainerRegistryUser: "unbind",
		GitRepoURL:            "https://github.com/unbindapp/tezara",
	})
}

func baseInputs() BuildInputs {
	return BuildInputs{
		CommitSHA:      "0123456789abcdef0123456789abcdef01234567",
		Builder:        "railpack",
		BuildContext:   ".",
		InstallCommand: "pnpm install",
		BuildCommand:   "pnpm turbo build --filter=web",
		RunCommand:     "pnpm --filter=web start",
		SecretsHash:    "secrets-a",
		UniqueFallback: uuid.New().String(),
	}
}

// Two services that build the same commit of the same repo the same way are the
// same build: one image, one shared cache.
func TestGenerateBuildMetadataIdenticalInputsShareImageAndCache(t *testing.T) {
	b := testBuilder()

	crawlerImage, crawlerCache := b.GenerateBuildMetadata(baseInputs())
	webImage, webCache := b.GenerateBuildMetadata(baseInputs())

	if crawlerImage != webImage {
		t.Errorf("identical inputs produced different images: %q vs %q", crawlerImage, webImage)
	}
	if crawlerCache != webCache {
		t.Errorf("identical inputs produced different cache refs: %q vs %q", crawlerCache, webCache)
	}
	if want := "registry.unbind.app/tezara:"; !strings.HasPrefix(crawlerImage, want) {
		t.Errorf("image %q does not start with %q", crawlerImage, want)
	}
}

// Anything that changes what gets built has to change both refs, otherwise two
// services collide on one mutable tag and serve each other's images.
func TestGenerateBuildMetadataBuildConfigSplitsImageAndCache(t *testing.T) {
	b := testBuilder()
	baseImage, baseCache := b.GenerateBuildMetadata(baseInputs())

	for _, tt := range []struct {
		name   string
		mutate func(*BuildInputs)
	}{
		{"builder", func(in *BuildInputs) { in.Builder = "docker" }},
		{"dockerfile path", func(in *BuildInputs) { in.DockerfilePath = "apps/crawler/Dockerfile" }},
		{"build context", func(in *BuildInputs) { in.BuildContext = "apps/crawler" }},
		{"install command", func(in *BuildInputs) { in.InstallCommand = "npm ci" }},
		{"build command", func(in *BuildInputs) { in.BuildCommand = "pnpm turbo build --filter=crawler" }},
		{"run command", func(in *BuildInputs) { in.RunCommand = "pnpm --filter=crawler start" }},
		{"build env", func(in *BuildInputs) { in.SecretsHash = "secrets-b" }},
	} {
		t.Run(tt.name, func(t *testing.T) {
			in := baseInputs()
			tt.mutate(&in)
			image, cache := b.GenerateBuildMetadata(in)

			if image == baseImage {
				t.Errorf("%s did not change the image ref (%q)", tt.name, image)
			}
			if cache == baseCache {
				t.Errorf("%s did not change the cache ref (%q)", tt.name, cache)
			}
		})
	}
}

// A new commit is a new image, but the same service keeps its cache across commits.
func TestGenerateBuildMetadataCommitChangesImageNotCache(t *testing.T) {
	b := testBuilder()
	baseImage, baseCache := b.GenerateBuildMetadata(baseInputs())

	next := baseInputs()
	next.CommitSHA = "fedcba9876543210fedcba9876543210fedcba98"
	image, cache := b.GenerateBuildMetadata(next)

	if image == baseImage {
		t.Errorf("a new commit reused image ref %q", image)
	}
	if cache != baseCache {
		t.Errorf("a new commit changed the cache ref: %q vs %q", cache, baseCache)
	}
}

// With no commit to identify the build we can't claim two builds are the same one,
// so the tag falls back to being unique per deployment rather than shared.
func TestGenerateBuildMetadataUnknownCommitStaysUnique(t *testing.T) {
	b := testBuilder()

	first := baseInputs()
	first.CommitSHA = ""
	second := baseInputs()
	second.CommitSHA = ""

	firstImage, firstCache := b.GenerateBuildMetadata(first)
	secondImage, secondCache := b.GenerateBuildMetadata(second)

	if firstImage == secondImage {
		t.Errorf("builds with an unknown commit shared image ref %q", firstImage)
	}
	if firstCache != secondCache {
		t.Errorf("an unknown commit should not split the cache: %q vs %q", firstCache, secondCache)
	}
}

func TestGenerateBuildMetadataDockerHubUsesUserPrefix(t *testing.T) {
	b := NewBuilder(&config.Config{
		ContainerRegistryHost: "docker.io",
		ContainerRegistryUser: "unbind",
		GitRepoURL:            "https://github.com/unbindapp/tezara",
	})

	image, cache := b.GenerateBuildMetadata(baseInputs())

	if want := "unbind/tezara:"; !strings.HasPrefix(image, want) {
		t.Errorf("image %q does not start with %q", image, want)
	}
	if want := "unbind/tezara:"; !strings.HasPrefix(cache, want) {
		t.Errorf("cache %q does not start with %q", cache, want)
	}
}

// An unparseable repo URL must still not collide with a different repo.
func TestRepoNameFallbackIsPerRepo(t *testing.T) {
	first := NewBuilder(&config.Config{GitRepoURL: "not-a-url"}).RepoName()
	second := NewBuilder(&config.Config{GitRepoURL: "also-not-a-url"}).RepoName()

	if first == second {
		t.Errorf("distinct unparseable repo URLs shared repo name %q", first)
	}
	if !strings.HasPrefix(first, "unbind-build-") {
		t.Errorf("unexpected fallback repo name %q", first)
	}
}
