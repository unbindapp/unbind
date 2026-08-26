package sourceanalyzer

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"

	a "github.com/railwayapp/railpack/core/app"
	"github.com/railwayapp/railpack/core/providers/node"
	"github.com/unbindapp/unbind-api/internal/sourceanalyzer/enum"
)

// AnalysisTarget carries the service config that tells us where in the repo the
// service actually lives, so detection can anchor on the right directory in
// monorepos instead of the clone root.
type AnalysisTarget struct {
	DockerfilePath string
	BuildContext   string
	RunCommand     string
}

// AnalyzeSourceCodeAnchored analyzes the directory the service is actually built
// from: the Dockerfile's directory (then the build context) when one is
// configured, otherwise the clone root — refined through workspace start-script
// filters (e.g. `pnpm --filter @acme/web start`) when the root is a bare
// workspace shell.
func AnalyzeSourceCodeAnchored(cloneDir string, target AnalysisTarget) (*AnalysisResult, error) {
	for _, rel := range []string{parentDir(target.DockerfilePath), target.BuildContext} {
		dir, ok := resolveSubDir(cloneDir, rel)
		if !ok {
			continue
		}
		if res, err := AnalyzeSourceCode(dir); err == nil && res.Provider != enum.UnknownProvider {
			return res, nil
		}
	}

	res, err := AnalyzeSourceCode(cloneDir)
	if err != nil {
		return nil, err
	}
	if res.Framework != enum.UnknownFramework {
		return res, nil
	}

	if dir, ok := resolveWorkspaceAppDir(cloneDir, target.RunCommand); ok {
		if wsRes, err := AnalyzeSourceCode(dir); err == nil && wsRes.Provider != enum.UnknownProvider {
			return wsRes, nil
		}
	}
	return res, nil
}

// Icon resolves the display icon for an analysis, preferring the most specific
// signal: framework, then provider, then the given fallback.
func (r *AnalysisResult) Icon(fallback string) string {
	switch {
	case r == nil:
		return fallback
	case r.Framework != enum.UnknownFramework:
		return string(r.Framework)
	case r.Provider != enum.UnknownProvider:
		return string(r.Provider)
	default:
		return fallback
	}
}

func parentDir(path string) string {
	if path == "" {
		return ""
	}
	dir := filepath.Dir(filepath.Clean(strings.TrimPrefix(path, "/")))
	if dir == "." || dir == "/" {
		return ""
	}
	return dir
}

// resolveSubDir joins rel onto root, rejecting empty paths, the root itself and
// anything escaping the clone (rel comes from user-controlled service config).
func resolveSubDir(root, rel string) (string, bool) {
	rel = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(rel), "/"))
	if rel == "" {
		return "", false
	}
	root = filepath.Clean(root)
	dir := filepath.Clean(filepath.Join(root, rel))
	if dir == root || !strings.HasPrefix(dir, root+string(filepath.Separator)) {
		return "", false
	}
	if info, err := os.Stat(dir); err != nil || !info.IsDir() {
		return "", false
	}
	return dir, true
}

// resolveWorkspaceAppDir maps a workspace root to the package the service runs:
// the package selected by the custom run command or the root start script,
// falling back to the only package with a start script.
func resolveWorkspaceAppDir(cloneDir, runCommand string) (string, bool) {
	app, err := a.NewApp(cloneDir)
	if err != nil {
		return "", false
	}
	ws, err := node.NewWorkspace(app)
	if err != nil || len(ws.Packages) == 0 {
		return "", false
	}

	for _, cmd := range []string{runCommand, ws.Root.PackageJson.Scripts["start"]} {
		sel := parseWorkspaceSelector(cmd)
		if sel == "" {
			continue
		}
		if dir, ok := resolveSubDir(cloneDir, sel); ok {
			return dir, true
		}
		for _, pkg := range ws.Packages {
			if pkg.PackageJson.Name == sel {
				return resolveSubDir(cloneDir, pkg.Path)
			}
		}
	}

	var withStart []string
	for _, pkg := range ws.Packages {
		if pkg.PackageJson.Scripts["start"] != "" {
			withStart = append(withStart, pkg.Path)
		}
	}
	if len(withStart) == 1 {
		return resolveSubDir(cloneDir, withStart[0])
	}
	return "", false
}

var workspaceSelectorPatterns = []*regexp.Regexp{
	regexp.MustCompile(`--filter[= ]+['"]?([^\s'"]+)`), // pnpm / turbo
	regexp.MustCompile(`\byarn\s+workspace\s+(\S+)`),
	regexp.MustCompile(`(?:--workspace|-w)[= ]+(\S+)`), // npm
}

func parseWorkspaceSelector(command string) string {
	if command == "" {
		return ""
	}
	for _, re := range workspaceSelectorPatterns {
		m := re.FindStringSubmatch(command)
		if m == nil {
			continue
		}
		// pnpm filters support `...` dependency selectors and glob patterns;
		// keep only plain package names or paths.
		sel := strings.TrimSuffix(strings.TrimPrefix(m[1], "..."), "...")
		if sel == "" || strings.ContainsAny(sel, "*{!") {
			continue
		}
		return sel
	}
	return ""
}
