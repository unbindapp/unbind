// portdetector/ruby.go
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

// DetectRubyPort returns the first explicit port number it can prove
// inside a Ruby repo.  If nothing matches → (nil, nil); caller then
// falls back (Rails default = 3000).
func (pd *PortDetector) DetectRubyPort(root string) (*int, error) {
	return pd.scanRubyFiles(root)
}

/* ------------------------------------------------------------------
   Regex catalogue (same struct-per-language pattern)
   -----------------------------------------------------------------*/

type RubyRegexes struct {
	InlineEnv  *regexp.Regexp // PORT=5000 rails s …
	RailsFlag  *regexp.Regexp // rails s -p 5000
	RackFlag   *regexp.Regexp // rackup -p 9292
	PumaFlag   *regexp.Regexp // puma --port 4000
	EnvAssign  *regexp.Regexp // ENV['PORT'] = '4000'
	SetPort    *regexp.Regexp // set :port, 4567      (Sinatra)
	PumaConfig *regexp.Regexp // port ENV.fetch("PORT") { 3000 }  |  port 3001
	TCPServer  *regexp.Regexp // TCPServer.new '0.0.0.0', 4567
}

func NewRubyRegexes() *RubyRegexes {
	return &RubyRegexes{
		InlineEnv:  regexp.MustCompile(`(?i)\bPORT\s*=\s*(\d{2,5})\b.*\b(?:ruby|rails|rackup|puma)\b`),
		RailsFlag:  regexp.MustCompile(`(?i)rails\s+(?:server|s)[^\n]*?-p\s*(\d{2,5})`),
		RackFlag:   regexp.MustCompile(`(?i)rackup[^\n]*?-p\s*(\d{2,5})`),
		PumaFlag:   regexp.MustCompile(`(?i)puma[^\n]*?--port\s*(\d{2,5})`),
		EnvAssign:  regexp.MustCompile(`ENV\[['"]PORT['"]\]\s*=\s*['"]?(\d{2,5})['"]?`),
		SetPort:    regexp.MustCompile(`(?i)set\s+:port\s*,\s*(\d{2,5})`),
		PumaConfig: regexp.MustCompile(`(?i)\bport\s+(?:ENV\.[^\d{]+(?:\{\s*(\d{2,5})\s*\})?|(\d{2,5}))`),
		TCPServer:  regexp.MustCompile(`TCPServer\.new\s+['"]\S*['"]\s*,\s*(\d{2,5})`),
	}
}

var rubyRe = NewRubyRegexes()

/* ------------------------------------------------------------------
   Walk *.rb / Gemfile / Dockerfile / shell scripts / .env
   -----------------------------------------------------------------*/

func (pd *PortDetector) scanRubyFiles(root string) (*int, error) {
	var port *int

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		if d.IsDir() {
			if strings.HasPrefix(d.Name(), ".") ||
				d.Name() == "vendor" || d.Name() == "bundle" {
				return filepath.SkipDir
			}
			return nil
		}

		ext := filepath.Ext(path)
		if ext != ".rb" && ext != ".sh" && ext != ".env" && ext != ".rake" &&
			d.Name() != "Dockerfile" && d.Name() != "Procfile" && d.Name() != "Gemfile" {
			return nil
		}

		data, _ := os.ReadFile(path)
		txt := string(data)

		switch {
		case matchPort(txt, rubyRe.InlineEnv, &port):
		case matchPort(txt, rubyRe.RailsFlag, &port):
		case matchPort(txt, rubyRe.RackFlag, &port):
		case matchPort(txt, rubyRe.PumaFlag, &port):
		case matchPort(txt, rubyRe.EnvAssign, &port):
		case matchPort(txt, rubyRe.SetPort, &port):
		case matchPort(txt, rubyRe.PumaConfig, &port):
		case matchPort(txt, rubyRe.TCPServer, &port):
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
