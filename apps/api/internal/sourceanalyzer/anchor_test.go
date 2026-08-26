package sourceanalyzer

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/unbindapp/unbind-api/internal/sourceanalyzer/enum"
)

const nextPackageJSON = `{
	"name": "@acme/web",
	"scripts": {"dev": "next dev", "build": "next build", "start": "next start"},
	"dependencies": {"next": "14.0.0", "react": "18.2.0", "react-dom": "18.2.0"}
}`

const plainNodePackageJSON = `{
	"name": "@acme/worker",
	"scripts": {"start": "node index.js"}
}`

func writeFixture(t *testing.T, files map[string]string) string {
	t.Helper()
	root := t.TempDir()
	for path, content := range files {
		full := filepath.Join(root, path)
		require.NoError(t, os.MkdirAll(filepath.Dir(full), 0o755))
		require.NoError(t, os.WriteFile(full, []byte(content), 0o644))
	}
	return root
}

func monorepoFixture(t *testing.T, rootStartScript string) string {
	t.Helper()
	return writeFixture(t, map[string]string{
		"package.json": `{
			"name": "acme",
			"private": true,
			"scripts": {"build": "turbo run build", "start": "` + rootStartScript + `"},
			"devDependencies": {"turbo": "^2"}
		}`,
		"pnpm-workspace.yaml":      "packages:\n  - \"apps/*\"\n",
		"apps/web/package.json":    nextPackageJSON,
		"apps/web/Dockerfile":      "FROM node:22-alpine\n",
		"apps/worker/package.json": plainNodePackageJSON,
		"apps/worker/index.js":     "console.log('hi')\n",
		"apps/worker/Dockerfile":   "FROM node:22-alpine\n",
	})
}

func TestAnchoredDockerfileDir(t *testing.T) {
	root := monorepoFixture(t, "turbo run start")

	res, err := AnalyzeSourceCodeAnchored(root, AnalysisTarget{DockerfilePath: "/apps/web/Dockerfile"})
	require.NoError(t, err)
	assert.Equal(t, enum.Node, res.Provider)
	assert.Equal(t, enum.Next, res.Framework)

	res, err = AnalyzeSourceCodeAnchored(root, AnalysisTarget{DockerfilePath: "apps/worker/Dockerfile"})
	require.NoError(t, err)
	assert.Equal(t, enum.Node, res.Provider)
	assert.Equal(t, enum.UnknownFramework, res.Framework)
}

func TestAnchoredBuildContextFallback(t *testing.T) {
	root := writeFixture(t, map[string]string{
		"docker/Dockerfile":     "FROM node:22-alpine\n",
		"apps/web/package.json": nextPackageJSON,
	})

	res, err := AnalyzeSourceCodeAnchored(root, AnalysisTarget{
		DockerfilePath: "docker/Dockerfile",
		BuildContext:   "apps/web",
	})
	require.NoError(t, err)
	assert.Equal(t, enum.Next, res.Framework)
}

func TestAnchoredWorkspaceStartFilter(t *testing.T) {
	root := monorepoFixture(t, "pnpm --filter @acme/web start")

	res, err := AnalyzeSourceCodeAnchored(root, AnalysisTarget{})
	require.NoError(t, err)
	assert.Equal(t, enum.Node, res.Provider)
	assert.Equal(t, enum.Next, res.Framework)
	require.NotNil(t, res.Port)
	assert.Equal(t, 3000, *res.Port)
}

func TestAnchoredWorkspaceRunCommand(t *testing.T) {
	root := monorepoFixture(t, "turbo run start")

	res, err := AnalyzeSourceCodeAnchored(root, AnalysisTarget{RunCommand: "pnpm --filter=@acme/web start"})
	require.NoError(t, err)
	assert.Equal(t, enum.Next, res.Framework)
}

func TestAnchoredWorkspaceSingleStartFallback(t *testing.T) {
	root := writeFixture(t, map[string]string{
		"package.json":          `{"name": "acme", "private": true, "scripts": {"build": "turbo run build"}}`,
		"pnpm-workspace.yaml":   "packages:\n  - \"apps/*\"\n",
		"apps/web/package.json": nextPackageJSON,
		"apps/lib/package.json": `{"name": "@acme/lib"}`,
	})

	res, err := AnalyzeSourceCodeAnchored(root, AnalysisTarget{})
	require.NoError(t, err)
	assert.Equal(t, enum.Next, res.Framework)
}

func TestAnchoredWorkspaceAmbiguousKeepsRoot(t *testing.T) {
	// Two packages with start scripts and no filter anywhere: keep the root result.
	root := monorepoFixture(t, "turbo run start")

	res, err := AnalyzeSourceCodeAnchored(root, AnalysisTarget{})
	require.NoError(t, err)
	assert.Equal(t, enum.Node, res.Provider)
	assert.Equal(t, enum.UnknownFramework, res.Framework)
}

func TestAnchoredPathEscapeIgnored(t *testing.T) {
	root := monorepoFixture(t, "turbo run start")

	res, err := AnalyzeSourceCodeAnchored(root, AnalysisTarget{DockerfilePath: "../../etc/Dockerfile"})
	require.NoError(t, err)
	assert.Equal(t, enum.Node, res.Provider)
	assert.Equal(t, enum.UnknownFramework, res.Framework)
}

func TestParseWorkspaceSelector(t *testing.T) {
	cases := map[string]string{
		"pnpm --filter @acme/web start":    "@acme/web",
		"pnpm --filter=@acme/web start":    "@acme/web",
		"turbo run start --filter=web":     "web",
		"yarn workspace @acme/web start":   "@acme/web",
		"npm run start -w apps/web":        "apps/web",
		"npm run start --workspace=web":    "web",
		"pnpm --filter @acme/web... start": "@acme/web",
		"pnpm --filter './apps/*' build":   "",
		"turbo run start":                  "",
		"":                                 "",
	}
	for command, want := range cases {
		assert.Equal(t, want, parseWorkspaceSelector(command), "command: %s", command)
	}
}

func TestAnalysisResultIcon(t *testing.T) {
	assert.Equal(t, "github", (*AnalysisResult)(nil).Icon("github"))
	assert.Equal(t, "next", (&AnalysisResult{Provider: enum.Node, Framework: enum.Next}).Icon("github"))
	assert.Equal(t, "node", (&AnalysisResult{Provider: enum.Node, Framework: enum.UnknownFramework}).Icon("github"))
	assert.Equal(t, "github", (&AnalysisResult{Provider: enum.UnknownProvider, Framework: enum.UnknownFramework}).Icon("github"))
}
