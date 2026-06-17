// portdetector/elixir.go
package portdetector

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

/* ------------------------------------------------------------------
   Public entry-point
   -----------------------------------------------------------------*/

// DetectElixirPort returns the first explicit port number it can prove
// inside an Elixir/Phoenix repo.  If nothing matches you get (nil, nil)
// and *no* default is applied by this detector.
func (pd *PortDetector) DetectElixirPort(root string) (*int, error) {
	return pd.scanElixirFiles(root)
}

/* ------------------------------------------------------------------
   Regex catalogue  (one struct per language, per your standard)
   -----------------------------------------------------------------*/

type ElixirRegexes struct {
	InlineEnv         *regexp.Regexp // PORT=4001 mix phx.server
	MixFlag           *regexp.Regexp // mix phx.server --port 4001
	SystemEnvFallback *regexp.Regexp // System.get_env("PORT") || 4001
	ConfigPort        *regexp.Regexp // port: 4001  (in *.exs)
	CowboyPort        *regexp.Regexp // Plug.Cowboy.http(..., port: 4001)
}

func NewElixirRegexes() *ElixirRegexes {
	return &ElixirRegexes{
		InlineEnv: regexp.MustCompile(
			`(?i)\bPORT\s*=\s*(\d{2,5})\b.*\bmix\b`),
		MixFlag: regexp.MustCompile(
			`(?i)mix\s+\S+[^\n]*?--port\s+(\d{2,5})`),
		SystemEnvFallback: regexp.MustCompile(
			`System\.get_env\(\s*["']PORT["']\s*\)\s*\|\|\s*(\d{2,5})`),
		ConfigPort: regexp.MustCompile(
			`(?i)port\s*:\s*["']?(\d{2,5})["']?`),
		CowboyPort: regexp.MustCompile(
			`Plug\.Cowboy\.(?:http|https|child_spec)\s*\([^)]*?port\s*:\s*(\d{2,5})`),
	}
}

var elixirRe = NewElixirRegexes()

/* ------------------------------------------------------------------
   Walk *.ex / *.exs / Dockerfile / shell / .env
   -----------------------------------------------------------------*/

func (pd *PortDetector) scanElixirFiles(root string) (*int, error) {
	var port *int

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			if strings.HasPrefix(d.Name(), ".") ||
				d.Name() == "_build" || d.Name() == "deps" {
				return filepath.SkipDir
			}
			return nil
		}

		ext := filepath.Ext(path)
		if ext != ".ex" && ext != ".exs" && ext != ".sh" && ext != ".env" &&
			d.Name() != "Dockerfile" && d.Name() != "Procfile" {
			return nil
		}

		data, _ := os.ReadFile(path)
		txt := string(data)

		switch {
		case matchPort(txt, elixirRe.InlineEnv, &port):
		case matchPort(txt, elixirRe.MixFlag, &port):
		case matchPort(txt, elixirRe.SystemEnvFallback, &port):
		case matchPort(txt, elixirRe.CowboyPort, &port):
		case matchPort(txt, elixirRe.ConfigPort, &port):
		default:
			return nil
		}

		if port != nil {
			return fs.SkipAll
		}
		return nil
	})

	if err != nil && err != fs.SkipAll {
		return nil, err
	}
	return port, nil
}
