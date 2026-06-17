// portdetector/go.go
package portdetector

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	// adjust to your logger
)

/* ------------------------------------------------------------------
   Public API
   -----------------------------------------------------------------*/

// DetectGoPort returns the first **explicit** port it can prove in a Go repo.
// It does NOT invent a default; if all regexes fail you get (nil, nil).
func (pd *PortDetector) DetectGoPort(root string) (*int, error) {
	return pd.scanGoFiles(root)
}

/* ------------------------------------------------------------------
   Regex catalogue – compiled once
   -----------------------------------------------------------------*/

type GoRegexes struct {
	InlineEnv     *regexp.Regexp
	FlagVar       *regexp.Regexp
	PortVar       *regexp.Regexp
	ListenLiteral *regexp.Regexp
	ColonLiteral  *regexp.Regexp
}

func NewGoRegexes() *GoRegexes {
	return &GoRegexes{
		InlineEnv:     regexp.MustCompile(`(?i)\bPORT\s*=\s*(\d{2,5})\b.*\bgo\b`),
		FlagVar:       regexp.MustCompile(`flag\.(?:Int|String)\s*\(\s*"(?:p|port)"\s*,\s*"?(\d{2,5})"`),
		PortVar:       regexp.MustCompile(`\bport\s*[:=]\s*"\s*(\d{2,5})\s*"`),
		ListenLiteral: regexp.MustCompile(`(?i)ListenAndServe(?:TLS)?\s*\(\s*"\s*:\s*(\d{2,5})`),
		ColonLiteral:  regexp.MustCompile(`"\s*:\s*(\d{2,5})"`),
	}
}

var goRegexes = NewGoRegexes()

/* ------------------------------------------------------------------
   Walk every .go / Dockerfile / script
   -----------------------------------------------------------------*/

func (pd *PortDetector) scanGoFiles(root string) (*int, error) {
	var port *int

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			if strings.HasPrefix(d.Name(), ".") ||
				d.Name() == "vendor" || d.Name() == "bin" {
				return filepath.SkipDir
			}
			return nil
		}

		// ── choose only the files we care about
		ext := filepath.Ext(path)
		if ext != ".go" && ext != ".sh" && ext != ".mk" && ext != ".bash" &&
			d.Name() != "Dockerfile" && d.Name() != "Procfile" {
			return nil
		}

		data, _ := os.ReadFile(path)
		txt := string(data)

		switch {
		case matchPort(txt, goRegexes.InlineEnv, &port):
		case matchPort(txt, goRegexes.FlagVar, &port):
		case matchPort(txt, goRegexes.PortVar, &port):
		case matchPort(txt, goRegexes.ListenLiteral, &port):
			// If ListenAndServe takes a raw ":"+port concat we may still
			// pick it up through rePortVar above, otherwise fall through.
		case port == nil && goRegexes.ColonLiteral.MatchString(txt):
			// catch edge-cases like fmt.Sprintf(":%s", portVar) but ONLY
			// when a literal ":1234" is present (rare, but cheap to scan)
			matchPort(txt, goRegexes.ColonLiteral, &port)
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
