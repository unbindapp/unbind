// portdetector/python.go
package portdetector

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	// or your own logger
)

/* ------------------------------------------------------------------
Public-facing entry point
-----------------------------------------------------------------*/
// DetectPythonPort scans .py / Dockerfile / Procfile / shell scripts
// and returns the first explicit port it can prove.
func (pd *PortDetector) DetectPythonPort(root string) (*int, error) {
	return pd.scanPythonFiles(root)
}

/*
------------------------------------------------------------------
Regexes (case-insensitive, DOTALL where needed)
-----------------------------------------------------------------
*/
type PythonRegexes struct {
	InlineEnv    *regexp.Regexp
	UvicornFlag  *regexp.Regexp
	GunicornBind *regexp.Regexp
	DjangoRun    *regexp.Regexp
	FlaskRun     *regexp.Regexp
}

func NewPythonRegexes() *PythonRegexes {
	return &PythonRegexes{
		InlineEnv:    regexp.MustCompile(`(?i)\bPORT\s*=\s*(\d{2,5})\b.*\b(?:uvicorn|gunicorn|hypercorn|python)\b`),
		UvicornFlag:  regexp.MustCompile(`(?i)uvicorn[^\n]*?--?p(?:ort)?\s+(\d{2,5})`),
		GunicornBind: regexp.MustCompile(`(?i)gunicorn[^\n]*?-b\s+\S*:(\d{2,5})`),
		DjangoRun:    regexp.MustCompile(`(?i)runserver\s+(?:[\d\.]+:)?(\d{2,5})`),
		FlaskRun:     regexp.MustCompile(`(?is)\.run\s*\(\s*(?:[^,)]*,\s*)*port\s*=\s*(\d{2,5})\s*(?:,|$|\))`),
	}
}

var pythonRegexes = NewPythonRegexes()

/*
------------------------------------------------------------------
Walk the tree
-----------------------------------------------------------------
*/
func (pd *PortDetector) scanPythonFiles(root string) (*int, error) {
	var port *int
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			if strings.HasPrefix(d.Name(), ".") || d.Name() == "venv" ||
				d.Name() == "__pycache__" {
				return filepath.SkipDir
			}
			return nil
		}
		switch ext := filepath.Ext(path); ext {
		case ".py", ".sh", ".txt", ".cfg", ".toml", ".ini":
		default:
			if d.Name() != "Dockerfile" && d.Name() != "Procfile" {
				return nil
			}
		}
		data, _ := os.ReadFile(path)
		txt := string(data)
		switch {
		case matchPort(txt, pythonRegexes.InlineEnv, &port):
		case matchPort(txt, pythonRegexes.UvicornFlag, &port):
		case matchPort(txt, pythonRegexes.GunicornBind, &port):
		case matchPort(txt, pythonRegexes.DjangoRun, &port):
		case matchPort(txt, pythonRegexes.FlaskRun, &port):
		default:
			return nil
		}
		return fs.SkipAll // got one — stop walking
	})
	if err != nil && err != fs.SkipAll {
		return nil, err
	}
	return port, nil
}
