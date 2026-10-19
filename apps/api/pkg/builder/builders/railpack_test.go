package builders

import (
	"context"
	"strings"
	"testing"

	"github.com/containerd/platforms"
	"github.com/moby/buildkit/client/llb"
	"github.com/moby/buildkit/solver/pb"
	"github.com/opencontainers/go-digest"
	rpBuildkit "github.com/railwayapp/railpack/buildkit"
	"github.com/railwayapp/railpack/core/plan"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/internal/gitenv"
	"google.golang.org/protobuf/proto"
)

// A new commit has to reach the build step without rerunning install
func TestAddBuildStepVariablesKeepsInstallCached(t *testing.T) {
	first := nodePlan()
	addBuildStepVariables(first, gitenv.Vars("1111111111111111111111111111111111111111", "main"))
	second := nodePlan()
	addBuildStepVariables(second, gitenv.Vars("2222222222222222222222222222222222222222", "main"))

	firstInstall, firstBuild := execOps(t, first)
	secondInstall, secondBuild := execOps(t, second)

	assert.Equal(t, firstInstall.digest, secondInstall.digest, "install step changed with the commit")
	assert.NotEqual(t, firstBuild.digest, secondBuild.digest, "build step did not change with the commit")
	assert.Contains(t, secondBuild.env, gitenv.KeySHA+"=2222222222222222222222222222222222222222")
	assert.Contains(t, secondBuild.env, gitenv.KeyBranch+"=main")
	assert.Equal(t, "1", second.Steps[1].Variables["NEXT_TELEMETRY_DISABLED"])
}

func TestAddBuildStepVariablesWithoutBuildStep(t *testing.T) {
	buildPlan := nodePlan()
	buildPlan.Steps = buildPlan.Steps[:1]

	addBuildStepVariables(buildPlan, gitenv.Vars("abc", "main"))

	assert.Empty(t, buildPlan.Steps[0].Variables)
}

func nodePlan() *plan.BuildPlan {
	buildPlan := plan.NewBuildPlan()

	install := plan.NewStep("install")
	install.Inputs = []plan.Layer{plan.NewImageLayer("node:22")}
	install.Commands = []plan.Command{plan.NewCopyCommand("package.json"), plan.NewExecCommand("npm ci")}

	build := plan.NewStep("build")
	build.Inputs = []plan.Layer{plan.NewStepLayer("install"), plan.NewLocalLayer()}
	build.Variables["NEXT_TELEMETRY_DISABLED"] = "1"
	build.Commands = []plan.Command{plan.NewExecCommand("npm run build")}

	buildPlan.Steps = []plan.Step{*install, *build}
	buildPlan.Deploy.Base = plan.NewImageLayer("node:22")
	buildPlan.Deploy.Inputs = []plan.Layer{plan.NewStepLayer("build", plan.NewIncludeFilter([]string{"."}))}
	return buildPlan
}

type execOp struct {
	digest digest.Digest
	env    []string
}

func execOps(t *testing.T, buildPlan *plan.BuildPlan) (install, build *execOp) {
	state, _, err := rpBuildkit.ConvertPlanToLLB(buildPlan, rpBuildkit.ConvertPlanOptions{
		BuildPlatform: platforms.DefaultSpec(),
		SecretsHash:   "secrets",
	})
	require.NoError(t, err)
	def, err := state.Marshal(context.Background(), llb.LinuxAmd64)
	require.NoError(t, err)

	ops := map[digest.Digest]*pb.Op{}
	for _, dt := range def.Def {
		var op pb.Op
		require.NoError(t, proto.Unmarshal(dt, &op))
		ops[digest.FromBytes(dt)] = &op
	}

	for dgst, op := range ops {
		exec := op.GetExec()
		if exec == nil {
			continue
		}
		found := &execOp{digest: stableDigest(t, ops, dgst), env: exec.Meta.Env}
		switch strings.Join(exec.Meta.Args, " ") {
		case "npm ci":
			install = found
		case "npm run build":
			build = found
		}
	}
	require.NotNil(t, install)
	require.NotNil(t, build)
	return install, build
}

// stableDigest hashes an op and its inputs without local.unique, which is random per
// conversion and not part of BuildKit's local source cache key (source/local/source.go).
func stableDigest(t *testing.T, ops map[digest.Digest]*pb.Op, dgst digest.Digest) digest.Digest {
	op := proto.Clone(ops[dgst]).(*pb.Op)
	if source := op.GetSource(); source != nil {
		delete(source.Attrs, "local.unique")
	}
	for _, input := range op.Inputs {
		input.Digest = string(stableDigest(t, ops, digest.Digest(input.Digest)))
	}
	dt, err := proto.MarshalOptions{Deterministic: true}.Marshal(op)
	require.NoError(t, err)
	return digest.FromBytes(dt)
}
