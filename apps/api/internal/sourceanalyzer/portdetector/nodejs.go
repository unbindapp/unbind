// portdetector/node.go
package portdetector

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

/* ----------------------------------------------------------------------
Public-facing API
--------------------------------------------------------------------*/
// DetectNodePort tries, in order:
// 1. PORT=… or --port … in an npm/yarn/pnpm script
// 2. process.env.PORT = … (runtime assignment)
// 3. app.listen(…) (hard-coded literal or fallback)
// 4. Return nil → caller falls back to (framework default)
func (pd *PortDetector) DetectNodePort(root string) (*int, error) {
	if p := pd.fromPackageJSON(root); p != nil {
		return p, nil
	}
	return pd.scanSource(root)
}

/*
----------------------------------------------------------------------
Regex catalogue
--------------------------------------------------------------------
*/
type NodeRegexes struct {
	InlineEnv        *regexp.Regexp
	FlagPort         *regexp.Regexp
	ProcessEnvAssign *regexp.Regexp
	ListenLiteral    *regexp.Regexp
	ListenFallback   *regexp.Regexp
	ServeOption      *regexp.Regexp // serve({ … port: 8787 })
}

func NewNodeRegexes() *NodeRegexes {
	return &NodeRegexes{
		InlineEnv:        regexp.MustCompile(`\bPORT\s*=\s*(\d{2,5})\b`),
		FlagPort:         regexp.MustCompile(`(?i)(?:--?p(?:ort)?=|--?p(?:ort)?\s+)(\d{2,5})`),
		ProcessEnvAssign: regexp.MustCompile(`process\.env\.PORT\s*=\s*(\d{2,5})`),
		ListenLiteral:    regexp.MustCompile(`\.listen\s*\(\s*(\d{2,5})`),
		ListenFallback:   regexp.MustCompile(`\.listen\s*\([^)]*\|\|\s*(\d{2,5})`),
		ServeOption:      regexp.MustCompile(`\bserve\s*\([^)]*?port\s*:\s*(\d{2,5})`),
	}
}

var nodeRegexes = NewNodeRegexes()

/*
----------------------------------------------------------------------
1. package.json (scripts)
--------------------------------------------------------------------
*/
func (pd *PortDetector) fromPackageJSON(root string) *int {
	data, err := os.ReadFile(filepath.Join(root, "package.json"))
	if err != nil {
		return nil
	}
	var pkg struct{ Scripts map[string]string }
	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil
	}
	for _, cmd := range pkg.Scripts {
		// PORT=4000 vite dev
		if m := nodeRegexes.InlineEnv.FindStringSubmatch(cmd); len(m) == 2 {
			if p, _ := strconv.Atoi(m[1]); p != 0 {
				return &p
			}
		}
		// vite dev --port 4000 | vite dev -p4000
		if m := nodeRegexes.FlagPort.FindStringSubmatch(cmd); len(m) == 2 {
			if p, _ := strconv.Atoi(m[1]); p != 0 {
				return &p
			}
		}
	}
	return nil
}

/*
----------------------------------------------------------------------
2–3. JS/TS source scan
--------------------------------------------------------------------
*/
func (pd *PortDetector) scanSource(root string) (*int, error) {
	var port *int
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			if d.Name() == "node_modules" || strings.HasPrefix(d.Name(), ".") {
				return filepath.SkipDir
			}
			return nil
		}
		switch filepath.Ext(path) {
		case ".js", ".mjs", ".cjs", ".ts", ".tsx":
		default:
			return nil
		}
		codeB, _ := os.ReadFile(path)
		code := string(codeB)
		// process.env.PORT = 1234
		if m := nodeRegexes.ProcessEnvAssign.FindStringSubmatch(code); len(m) == 2 {
			if n, _ := strconv.Atoi(m[1]); n != 0 {
				port = &n
				return fs.SkipAll
			}
		}
		// app.listen(PORT || 1234)
		if m := nodeRegexes.ListenFallback.FindStringSubmatch(code); len(m) == 2 {
			if n, _ := strconv.Atoi(m[1]); n != 0 {
				port = &n
				return fs.SkipAll
			}
		}
		// app.listen(1234)
		if m := nodeRegexes.ListenLiteral.FindStringSubmatch(code); len(m) == 2 {
			if n, _ := strconv.Atoi(m[1]); n != 0 {
				port = &n
				return fs.SkipAll
			}
		}
		// serve({ port: 1234 })
		if m := nodeRegexes.ServeOption.FindStringSubmatch(code); len(m) == 2 {
			if n, _ := strconv.Atoi(m[1]); n != 0 {
				port = &n
				return fs.SkipAll
			}
		}
		return nil
	})
	if err != nil && err != fs.SkipAll {
		return nil, err
	}
	return port, nil
}
