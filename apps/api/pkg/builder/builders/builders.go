package builders

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"maps"
	"slices"
	"strings"

	"github.com/go-git/go-git/v5"
	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/pkg/builder/config"
)

type Builder struct {
	config *config.Config
}

func NewBuilder(config *config.Config) *Builder {
	return &Builder{
		config: config,
	}
}

// BuildInputs is everything about a service that can change the content of the
// image it produces. It deliberately excludes the service's own identity: two
// services that build the same commit of the same repo with the same
// configuration produce the same image, so they should share both the tag and
// the build cache.
type BuildInputs struct {
	CommitSHA      string
	Builder        string
	DockerfilePath string
	BuildContext   string
	InstallCommand string
	BuildCommand   string
	RunCommand     string
	// SecretsHash covers build-time env values, which are baked into the image by
	// plenty of frameworks (NEXT_PUBLIC_* and friends), so two services that share
	// a repo and commands but not their build env still get distinct images.
	SecretsHash string
	// UniqueFallback is mixed into the tag only when CommitSHA could not be
	// resolved, so two builds can never share a mutable ref by accident.
	UniqueFallback string
}

// configDigest hashes the inputs that survive across commits. The registry cache
// ref is keyed on this rather than on the commit, so a service keeps its cache as
// the repo moves while a service with a different dockerfile path, context,
// commands or build env gets its own cache instead of thrashing a shared one.
func (in BuildInputs) configDigest() string {
	return shortDigest(
		in.Builder,
		in.DockerfilePath,
		in.BuildContext,
		in.InstallCommand,
		in.BuildCommand,
		in.RunCommand,
		in.SecretsHash,
	)
}

// tag is commit-scoped, so a new commit yields a new image ref (and therefore a
// pull) while an identical rebuild resolves to the same ref and re-pushes the
// same content. Rollouts don't depend on the tag moving: the operator puts the
// deployment ID in the pod template labels, so every deployment rolls anyway.
func (in BuildInputs) tag() string {
	cfgDigest := in.configDigest()
	if in.CommitSHA == "" {
		// Without a commit we can't say two builds are the same build, and guessing
		// wrong means a service silently serves another service's image.
		log.Warn("Building without a resolved commit SHA, tagging image uniquely instead of by content")
		return fmt.Sprintf("%s-%s", shortDigest(in.UniqueFallback), cfgDigest)
	}
	sha := strings.ToLower(in.CommitSHA)
	if len(sha) > 12 {
		sha = sha[:12]
	}
	return fmt.Sprintf("%s-%s", sha, cfgDigest)
}

// RepoName is the image repository a service's git repo publishes to. Every
// service built from the same repo shares it; the tag is what tells them apart.
func (self *Builder) RepoName() string {
	repoName, err := utils.ExtractRepoName(self.config.GitRepoURL)
	if err != nil {
		log.Warnf("Failed to extract repository name: %v", err)
		// Deterministic per repo URL, so a repo that can't be parsed still can't
		// collide with a different one.
		return fmt.Sprintf("unbind-build-%s", shortDigest(self.config.GitRepoURL))
	}
	return repoName
}

// GenerateBuildMetadata returns the image ref to build and push, and the registry
// cache ref to import/export. Both are derived from the build inputs, not from a
// wall clock: a timestamped tag let two concurrent builds of one repo (a monorepo
// push fans out to every service on it, and the queue runs them together) land on
// the same mutable ref, so the loser's service silently started serving the
// winner's image on its next pull.
func (self *Builder) GenerateBuildMetadata(inputs BuildInputs) (outputImage string, cacheKey string) {
	registry := self.config.ContainerRegistryHost
	if registry == "" || registry == "docker.io" {
		// Docker Hub wants username/repository, with no registry host prefix
		registry = self.config.ContainerRegistryUser
	}

	repoName := self.RepoName()
	outputImage = fmt.Sprintf("%s/%s:%s", registry, repoName, inputs.tag())
	cacheKey = fmt.Sprintf("%s/%s:%s-buildcache", registry, repoName, inputs.configDigest())

	return outputImage, cacheKey
}

// buildInputs collects the build configuration for the clone at repoDir. Callers
// must apply any defaults (e.g. an empty dockerfile path meaning "Dockerfile")
// before calling, so equivalent configurations hash identically.
func (self *Builder) buildInputs(repoDir string, buildSecrets map[string]string) BuildInputs {
	return BuildInputs{
		CommitSHA:      self.resolveCommitSHA(repoDir),
		Builder:        string(self.config.ServiceBuilder),
		DockerfilePath: self.config.ServiceDockerBuilderDockerfilePath,
		BuildContext:   self.config.ServiceDockerBuilderBuildContext,
		InstallCommand: self.config.RailpackInstallCommand,
		BuildCommand:   self.config.RailpackBuildCommand,
		RunCommand:     self.config.ServiceRunCommand,
		SecretsHash:    secretsHash(buildSecrets),
		UniqueFallback: self.config.ServiceDeploymentID.String(),
	}
}

// resolveCommitSHA reports the commit the build actually runs against. Git pushes
// don't pass a SHA to the builder (the webhook only records it on the deployment
// row and clones by ref), so it's read back out of the clone.
func (self *Builder) resolveCommitSHA(repoDir string) string {
	if self.config.CheckoutCommitSHA != "" {
		return self.config.CheckoutCommitSHA
	}

	repo, err := git.PlainOpen(repoDir)
	if err != nil {
		log.Warnf("Failed to open clone at %s to resolve HEAD: %v", repoDir, err)
		return ""
	}
	head, err := repo.Head()
	if err != nil {
		log.Warnf("Failed to resolve HEAD of clone at %s: %v", repoDir, err)
		return ""
	}
	return head.Hash().String()
}

// secretsHash feeds railpack's secrets-hash mount so cached steps are invalidated
// when a secret value changes, not only when the set of keys changes
// (railpack buildkit/build_llb/build_graph.go). It also identifies build-time env
// in the image tag, since that env is often baked into the build output.
func secretsHash(secrets map[string]string) string {
	h := sha256.New()
	for _, k := range slices.Sorted(maps.Keys(secrets)) {
		h.Write([]byte(k))
		h.Write([]byte{0})
		h.Write([]byte(secrets[k]))
		h.Write([]byte{0})
	}
	return hex.EncodeToString(h.Sum(nil))
}

func shortDigest(parts ...string) string {
	h := sha256.New()
	for _, p := range parts {
		h.Write([]byte(p))
		h.Write([]byte{0})
	}
	return hex.EncodeToString(h.Sum(nil))[:12]
}
