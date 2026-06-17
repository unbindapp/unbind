package sourceanalyzer

import (
	"path/filepath"
	"regexp"
	"strings"

	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/common/utils"
	"github.com/unbindapp/unbind-api/internal/sourceanalyzer/enum"
)

// FrameworkDetector handles framework detection for different providers
type FrameworkDetector struct {
	provider  enum.Provider
	sourceDir string
}

// NewFrameworkDetector creates a new FrameworkDetector instance
func NewFrameworkDetector(provider enum.Provider, sourceDir string) *FrameworkDetector {
	return &FrameworkDetector{
		provider:  provider,
		sourceDir: sourceDir,
	}
}

// DetectFramework inspects the project and returns the detected framework
func DetectFramework(provider enum.Provider, sourceDir string) enum.Framework {
	fd := NewFrameworkDetector(provider, sourceDir)
	switch {
	case fd.isSvelteKitApp():
		return enum.Sveltekit
	case fd.isSvelteApp():
		return enum.Svelte
	case fd.isSolidApp():
		return enum.Solid
	case fd.isHonoApp():
		return enum.Hono
	case fd.isTanStackStartApp():
		return enum.TanstackStart
	case fd.isViteApp():
		return enum.Vite
	case fd.isExpressApp():
		return enum.Express
	default:
		return enum.UnknownFramework
	}
}

// ---------------------------------------------------------------------------
// Individual framework detectors
// ---------------------------------------------------------------------------

func (fd *FrameworkDetector) isTanStackStartApp() bool {
	// Primary indicator
	if fd.hasDependency("@tanstack/react-start") && fd.hasScriptKeyword("vinxi") {
		return true
	}
	return false
}

func (fd *FrameworkDetector) isViteApp() bool {
	if fd.hasDependency("vite") || fd.hasScriptKeyword("vite") {
		return true
	}
	return fd.hasAnyFile([]string{"vite.config.js", "vite.config.ts", "vite.config.mjs", "vite.config.cjs"})
}

func (fd *FrameworkDetector) isSvelteKitApp() bool {
	if fd.hasDependency("@sveltejs/kit") || fd.hasScriptKeyword("svelte-kit") {
		return true
	}
	// SvelteKit always has a svelte.config.* file in root
	return fd.hasAnyFile([]string{"svelte.config.js", "svelte.config.ts", "svelte.config.cjs", "svelte.config.mjs"})
}

func (fd *FrameworkDetector) isSvelteApp() bool {
	// Must contain svelte, but we already checked for kit above
	if fd.hasDependency("svelte") || fd.hasScriptKeyword("svelte") {
		return true
	}
	// Svelte projects may also ship a svelte.config.*
	return fd.hasAnyFile([]string{"svelte.config.js", "svelte.config.ts", "svelte.config.cjs", "svelte.config.mjs"})
}

func (fd *FrameworkDetector) isSolidApp() bool {
	if fd.hasDependency("solid-js") || fd.hasDependency("solid-start") {
		return true
	}
	return fd.hasScriptKeyword("solid-start") || fd.hasAnyFile([]string{"solid.config.ts", "solid.config.js"})
}

func (fd *FrameworkDetector) isHonoApp() bool {
	if fd.hasDependency("hono") {
		return true
	}
	// Fast source scan: look for `new Hono()` in TypeScript / JavaScript files
	tsFiles, _ := utils.FindFilesWithExclusions(fd.sourceDir, "*.{ts,js,tsx,jsx}", []string{"node_modules", ".git"})
	honoInit := regexp.MustCompile(`(?m)new\s+Hono\s*\(`)
	for _, f := range tsFiles {
		if content, err := utils.ReadFile(f); err == nil && honoInit.Match([]byte(content)) {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// Express detector
// ---------------------------------------------------------------------------

func (fd *FrameworkDetector) isExpressApp() bool {
	if fd.provider == enum.Deno {
		return false // Express is Node.js only
	}

	// Check for express in package.json dependencies
	packageJSONPath := filepath.Join(fd.sourceDir, "package.json")
	if utils.FileExists(packageJSONPath) {
		content, err := utils.ReadFile(packageJSONPath)
		if err == nil {
			// Check if express is listed as a dependency
			if strings.Contains(content, "\"express\":") || strings.Contains(content, "'express':") {
				// Look for express app initialization pattern in JavaScript files
				jsFiles, err := utils.FindFilesWithExclusions(fd.sourceDir, "*.js", []string{"node_modules", ".git"})
				if err == nil {
					// Patterns to look for in source code
					expressInitRegex := regexp.MustCompile(`(?m)(const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]express['"]\s*\)`)
					expressListenRegex := regexp.MustCompile(`(?m)\.listen\s*\(\s*(\d+|process\.env\.[A-Z_]+)`)

					for _, file := range jsFiles {
						content, err := utils.ReadFile(file)
						if err == nil {
							// Check if file imports express and has listen method
							if expressInitRegex.MatchString(content) && expressListenRegex.MatchString(content) {
								log.Infof("Found Express app initialization in %s", file)
								return true
							}
						}
					}
				}

				// If we found express in dependencies but couldn't confirm with code pattern,
				// still return true since it's likely an Express app
				return true
			}
		}
	}

	return false
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

func (fd *FrameworkDetector) hasDenoDependency(dep string) bool {
	for _, fname := range []string{"deno.json", "deno.jsonc"} {
		denoJSONPath := filepath.Join(fd.sourceDir, fname)
		if !utils.FileExists(denoJSONPath) {
			continue
		}

		content, err := utils.ReadFile(denoJSONPath)
		if err != nil {
			continue
		}
		// Check in imports section
		if strings.Contains(content, "\""+dep+"\":") || strings.Contains(content, "'"+dep+"':") {
			return true
		}
	}
	return false
}

func (fd *FrameworkDetector) hasDenoScriptKeyword(kw string) bool {
	for _, fname := range []string{"deno.json", "deno.jsonc"} {
		denoJSONPath := filepath.Join(fd.sourceDir, fname)
		if !utils.FileExists(denoJSONPath) {
			continue
		}

		content, err := utils.ReadFile(denoJSONPath)
		if err != nil {
			continue
		}
		// A quick heuristic – any occurrence within tasks is good enough
		taskRegex := regexp.MustCompile(`"tasks"\s*:\s*{[\s\S]*?}`)
		m := taskRegex.Find([]byte(content))
		if m != nil && strings.Contains(string(m), kw) {
			return true
		}
	}
	return false
}

func (fd *FrameworkDetector) hasDependency(dep string) bool {
	if fd.provider == enum.Deno {
		return fd.hasDenoDependency(dep)
	}

	packageJSONPath := filepath.Join(fd.sourceDir, "package.json")
	if !utils.FileExists(packageJSONPath) {
		return false
	}

	content, err := utils.ReadFile(packageJSONPath)
	if err != nil {
		return false
	}
	// naïve but fast scan of dependencies/devDependencies
	return strings.Contains(content, "\""+dep+"\":") || strings.Contains(content, "'"+dep+"':")
}

func (fd *FrameworkDetector) hasScriptKeyword(kw string) bool {
	if fd.provider == enum.Deno {
		return fd.hasDenoScriptKeyword(kw)
	}

	packageJSONPath := filepath.Join(fd.sourceDir, "package.json")
	if !utils.FileExists(packageJSONPath) {
		return false
	}

	content, err := utils.ReadFile(packageJSONPath)
	if err != nil {
		return false
	}
	// A quick heuristic – any occurrence within scripts is good enough
	scriptRegex := regexp.MustCompile(`"scripts"\s*:\s*{[\s\S]*?}`)
	m := scriptRegex.Find([]byte(content))
	if m == nil {
		return false
	}
	return strings.Contains(string(m), kw)
}

func (fd *FrameworkDetector) hasAnyFile(files []string) bool {
	for _, f := range files {
		if utils.FileExists(filepath.Join(fd.sourceDir, f)) {
			return true
		}
	}
	return false
}
