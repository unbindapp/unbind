package buildkit

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/containerd/platforms"
	"github.com/moby/buildkit/client/llb"
	"github.com/moby/buildkit/solver/pb"
	rpBuildkit "github.com/railwayapp/railpack/buildkit"
	"github.com/railwayapp/railpack/core/plan"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
)

func TestDockerfileBuildArgs(t *testing.T) {
	dockerfile := `FROM node:22 AS builder
ARG NEXT_PUBLIC_SITE_URL
ARG MEILI_URL_INTERNAL=http://build.invalid
ARG A B=1
arg lowercase
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN --mount=type=secret,id=SECRET_ONLY echo
`
	path := filepath.Join(t.TempDir(), "Dockerfile")
	require.NoError(t, os.WriteFile(path, []byte(dockerfile), 0o644))

	secrets := map[string]string{
		"NEXT_PUBLIC_SITE_URL": "https://example.com",
		"MEILI_URL_INTERNAL":   "http://meili:7700",
		"B":                    "2",
		"lowercase":            "yes",
		"SECRET_ONLY":          "hidden",
		"UNDECLARED":           "ignored",
	}

	attrs, err := dockerfileBuildArgs(path, secrets)
	require.NoError(t, err)
	assert.Equal(t, map[string]string{
		"build-arg:NEXT_PUBLIC_SITE_URL": "https://example.com",
		"build-arg:MEILI_URL_INTERNAL":   "http://meili:7700",
		"build-arg:B":                    "2",
		"build-arg:lowercase":            "yes",
	}, attrs)
}

func TestDockerfileBuildArgsMissingFile(t *testing.T) {
	_, err := dockerfileBuildArgs(filepath.Join(t.TempDir(), "missing"), nil)
	assert.Error(t, err)
}

func TestRailpackPlanToLLBDisableCache(t *testing.T) {
	t.Setenv("RAILPACK_DISABLE_CACHES", "")

	for _, disableCache := range []bool{false, true} {
		t.Run(fmt.Sprintf("disableCache=%t", disableCache), func(t *testing.T) {
			state, _, err := railpackPlanToLLB(pnpmPlan(), rpBuildkit.ConvertPlanOptions{
				BuildPlatform: platforms.DefaultSpec(),
				CacheKey:      "test",
			}, disableCache)
			require.NoError(t, err)

			def, err := state.Marshal(context.Background(), llb.LinuxAmd64)
			require.NoError(t, err)

			assert.Equal(t, !disableCache, hasCacheMount(t, def))
		})
	}
}

func pnpmPlan() *plan.BuildPlan {
	buildPlan := plan.NewBuildPlan()
	buildPlan.Caches["pnpm"] = &plan.Cache{Directory: "/root/.local/share/pnpm/store", Type: "shared"}

	install := plan.NewStep("install")
	install.Inputs = []plan.Layer{plan.NewImageLayer("node:22"), plan.NewLocalLayer()}
	install.Caches = []string{"pnpm"}
	install.Commands = []plan.Command{plan.NewExecCommand("pnpm install --frozen-lockfile")}
	buildPlan.Steps = []plan.Step{*install}

	buildPlan.Deploy.Base = plan.NewImageLayer("node:22")
	buildPlan.Deploy.Inputs = []plan.Layer{plan.NewStepLayer("install", plan.NewIncludeFilter([]string{"."}))}
	return buildPlan
}

func hasCacheMount(t *testing.T, def *llb.Definition) bool {
	for _, dt := range def.Def {
		var op pb.Op
		require.NoError(t, proto.Unmarshal(dt, &op))
		exec := op.GetExec()
		if exec == nil {
			continue
		}
		for _, m := range exec.Mounts {
			if m.MountType == pb.MountType_CACHE {
				return true
			}
		}
	}
	return false
}
