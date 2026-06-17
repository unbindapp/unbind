// portdetector/deno.go
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

/* ------------------------------------------------------------------
   Public entry-point
   -----------------------------------------------------------------*/

// DetectDenoPort returns the first explicit port number it can prove
// in a Deno repo.  If nothing matches you get (nil, nil) and the caller
// may fall back to a framework default (Fresh = 8000, etc.) if desired.
func (pd *PortDetector) DetectDenoPort(root string) (*int, error) {
	if p := pd.fromDenoJSON(root); p != nil {
		return p, nil
	}
	return pd.scanDenoSource(root)
}

/* ------------------------------------------------------------------
   Regex catalogue  –  one struct, same style as others
   -----------------------------------------------------------------*/

type DenoRegexes struct {
	InlineEnv      *regexp.Regexp //  PORT=9000 deno run …
	FlagPort       *regexp.Regexp //  deno run --port 9000
	FlagListen     *regexp.Regexp //  deno run --listen 0.0.0.0:9000
	EnvGet         *regexp.Regexp //  Deno.env.get("PORT") ?? 9000
	ServeOption    *regexp.Regexp //  serve(handler, { port: 9000 })
	ListenAndServe *regexp.Regexp //  listenAndServe(":9000", …)
	DenoListen     *regexp.Regexp //  Deno.listen({ port: 9000 })
	ListenLiteral  *regexp.Regexp // app.listen(8000)
	ListenFallback *regexp.Regexp // app.listen(PORT || 8000)
}

func NewDenoRegexes() *DenoRegexes {
	return &DenoRegexes{
		InlineEnv:   regexp.MustCompile(`(?i)\bPORT\s*=\s*(\d{2,5})\b.*\bdeno\b`),
		FlagPort:    regexp.MustCompile(`--port\s*=?\s*(\d{2,5})`),
		FlagListen:  regexp.MustCompile(`--listen\s+\S*:(\d{2,5})`),
		EnvGet:      regexp.MustCompile(`Deno\.env\.(?:get|getSync)\s*\(\s*["']PORT["']\s*\)\s*\|\|\s*(\d{2,5})`),
		ServeOption: regexp.MustCompile(`\bserve\s*\([^)]*?port\s*:\s*(\d{2,5})`),
		ListenAndServe: regexp.MustCompile(
			`listenAndServe(?:TLS)?\s*\(\s*["']\s*:\s*(\d{2,5})`),
		DenoListen:     regexp.MustCompile(`Deno\.listen\s*\([^)]*?port\s*:\s*(\d{2,5})`),
		ListenLiteral:  regexp.MustCompile(`\.listen\s*\(\s*(\d{2,5})`),
		ListenFallback: regexp.MustCompile(`\.listen\s*\([^)]*\|\|\s*(\d{2,5})`),
	}
}

var denoRe = NewDenoRegexes()

/* ------------------------------------------------------------------
   1.  deno.json / deno.jsonc  –  tasks section
   -----------------------------------------------------------------*/

func (pd *PortDetector) fromDenoJSON(root string) *int {
	for _, fname := range []string{"deno.json", "deno.jsonc"} {
		data, err := os.ReadFile(filepath.Join(root, fname))
		if err != nil {
			continue
		}
		var doc struct {
			Tasks map[string]string `json:"tasks"`
		}
		if err := json.Unmarshal(data, &doc); err != nil {
			continue // jsonc with comments? ignore silently
		}
		for _, cmd := range doc.Tasks {
			if m := denoRe.InlineEnv.FindStringSubmatch(cmd); len(m) == 2 {
				if p, _ := strconv.Atoi(m[1]); p != 0 {
					return &p
				}
			}
			if m := denoRe.FlagPort.FindStringSubmatch(cmd); len(m) == 2 {
				if p, _ := strconv.Atoi(m[1]); p != 0 {
					return &p
				}
			}
			if m := denoRe.FlagListen.FindStringSubmatch(cmd); len(m) == 2 {
				if p, _ := strconv.Atoi(m[1]); p != 0 {
					return &p
				}
			}
		}
	}
	return nil
}

/* ------------------------------------------------------------------
   2.  *.ts / *.js source scan
   -----------------------------------------------------------------*/

func (pd *PortDetector) scanDenoSource(root string) (*int, error) {
	var port *int
	var hasServe bool

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			if strings.HasPrefix(d.Name(), ".") ||
				d.Name() == "node_modules" {
				return filepath.SkipDir
			}
			return nil
		}
		switch filepath.Ext(path) {
		case ".ts", ".tsx", ".js", ".mjs":
		default:
			return nil
		}

		data, _ := os.ReadFile(path)
		txt := string(data)

		// Check for Deno.serve without an explicit port
		if strings.Contains(txt, "Deno.serve") {
			hasServe = true
		}

		switch {
		case matchPort(txt, denoRe.EnvGet, &port):
		case matchPort(txt, denoRe.ServeOption, &port):
		case matchPort(txt, denoRe.ListenAndServe, &port):
		case matchPort(txt, denoRe.DenoListen, &port):
		case matchPort(txt, denoRe.ListenFallback, &port):
		case matchPort(txt, denoRe.ListenLiteral, &port):
		default:
			return nil
		}
		return fs.SkipAll
	})

	if err != nil && err != fs.SkipAll {
		return nil, err
	}

	// If we found Deno.serve but no explicit port, return default port 8000
	if hasServe && port == nil {
		defaultPort := 8000
		port = &defaultPort
	}
	return port, nil
}
