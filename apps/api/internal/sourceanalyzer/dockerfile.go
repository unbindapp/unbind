package sourceanalyzer

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/distribution/reference"
	"github.com/moby/buildkit/frontend/dockerfile/instructions"
	"github.com/moby/buildkit/frontend/dockerfile/parser"
	"github.com/unbindapp/unbind-api/internal/sourceanalyzer/enum"
)

var baseImageProviders = map[string]enum.Provider{
	"library/rust":            enum.Rust,
	"rustlang/rust":           enum.Rust,
	"library/golang":          enum.Go,
	"library/node":            enum.Node,
	"oven/bun":                enum.Bun,
	"denoland/deno":           enum.Deno,
	"library/python":          enum.Python,
	"library/ruby":            enum.Ruby,
	"library/php":             enum.PHP,
	"library/elixir":          enum.Elixir,
	"library/openjdk":         enum.Java,
	"library/eclipse-temurin": enum.Java,
	"library/amazoncorretto":  enum.Java,
	"library/maven":           enum.Java,
	"library/gradle":          enum.Java,
	"dotnet/sdk":              enum.Dotnet,
	"dotnet/aspnet":           enum.Dotnet,
	"dotnet/runtime":          enum.Dotnet,
	"gleam-lang/gleam":        enum.Gleam,
}

// analyzeDockerfileStages follows the final stage back through the stages it uses,
// detecting from the folders they copy in, then from their base images.
func analyzeDockerfileStages(cloneDir string, target AnalysisTarget) *AnalysisResult {
	stages := parseDockerfileStages(cloneDir, target.DockerfilePath)
	if len(stages) == 0 {
		return nil
	}
	contextDir, ok := resolveSubDir(cloneDir, target.BuildContext)
	if !ok {
		contextDir = cloneDir
	}
	used := stagesUsedByFinal(stages)

	tried := map[string]bool{}
	for _, stage := range used {
		for _, src := range contextSources(stage) {
			for _, rel := range []string{src, parentDir(src)} {
				dir, ok := resolveSubDir(contextDir, rel)
				if !ok || tried[dir] {
					continue
				}
				tried[dir] = true
				if res, err := AnalyzeSourceCode(dir); err == nil && res.Provider != enum.UnknownProvider {
					return res
				}
			}
		}
	}

	for _, stage := range used {
		if provider := baseImageProvider(stage.BaseName); provider != enum.UnknownProvider {
			return &AnalysisResult{Provider: provider, Framework: enum.UnknownFramework}
		}
	}
	return nil
}

func parseDockerfileStages(cloneDir, dockerfilePath string) []instructions.Stage {
	if dockerfilePath == "" {
		dockerfilePath = "Dockerfile"
	}
	dir := cloneDir
	if rel := parentDir(dockerfilePath); rel != "" {
		var ok bool
		if dir, ok = resolveSubDir(cloneDir, rel); !ok {
			return nil
		}
	}

	path := filepath.Join(dir, filepath.Base(filepath.Clean(dockerfilePath)))
	if info, err := os.Lstat(path); err != nil || !info.Mode().IsRegular() {
		return nil
	}
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	parsed, err := parser.Parse(f)
	if err != nil {
		return nil
	}
	stages, _, err := instructions.Parse(parsed.AST, nil)
	if err != nil {
		return nil
	}
	return stages
}

// stagesUsedByFinal returns the final stage and every stage it builds on or copies from, nearest first
func stagesUsedByFinal(stages []instructions.Stage) []instructions.Stage {
	byName := map[string]int{}
	for i, stage := range stages {
		if stage.Name != "" {
			byName[stage.Name] = i
		}
	}
	find := func(ref string) (int, bool) {
		if i, ok := byName[strings.ToLower(ref)]; ok {
			return i, true
		}
		i, err := strconv.Atoi(ref)
		return i, err == nil && i >= 0 && i < len(stages)
	}

	final := len(stages) - 1
	queue := []int{final}
	seen := map[int]bool{final: true}
	var used []instructions.Stage
	for len(queue) > 0 {
		i := queue[0]
		queue = queue[1:]
		used = append(used, stages[i])

		refs := []string{stages[i].BaseName}
		for _, cmd := range stages[i].Commands {
			if c, ok := cmd.(*instructions.CopyCommand); ok && c.From != "" {
				refs = append(refs, c.From)
			}
		}
		for _, ref := range refs {
			j, ok := find(ref)
			if !ok || seen[j] {
				continue
			}
			seen[j] = true
			queue = append(queue, j)
		}
	}
	return used
}

// contextSources lists the build context paths a stage copies in
func contextSources(stage instructions.Stage) []string {
	var sources []string
	for _, cmd := range stage.Commands {
		switch c := cmd.(type) {
		case *instructions.CopyCommand:
			if c.From == "" {
				sources = append(sources, c.SourcePaths...)
			}
		case *instructions.AddCommand:
			sources = append(sources, c.SourcePaths...)
		}
	}
	return sources
}

func baseImageProvider(image string) enum.Provider {
	named, err := reference.ParseNormalizedNamed(image)
	if err != nil {
		return enum.UnknownProvider
	}
	if provider, ok := baseImageProviders[reference.Path(named)]; ok {
		return provider
	}
	return enum.UnknownProvider
}
