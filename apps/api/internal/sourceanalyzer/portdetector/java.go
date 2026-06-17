// portdetector/java.go
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

// DetectJavaPort returns the first **explicit** port number it can
// prove inside a Java/Kotlin/Groovy repo.  If nothing matches you get
// (nil, nil) so the caller can fall back; the only framework default
// you care about is Spring-Boot (8080) – add that in detector.go.
func (pd *PortDetector) DetectJavaPort(root string) (*int, error) {
	return pd.scanJavaFiles(root)
}

/* ------------------------------------------------------------------
   Regex catalogue  (one struct, same pattern as Go)
   -----------------------------------------------------------------*/

type JavaRegexes struct {
	InlineEnv      *regexp.Regexp // PORT=8080 java -jar …
	SpringFlag     *regexp.Regexp // --server.port=8080
	SystemProperty *regexp.Regexp // -Dserver.port=8080
	PropsFile      *regexp.Regexp // server.port = 8080
	YamlPort       *regexp.Regexp // server.port: 8080  (or under server:)
	ListenLiteral  *regexp.Regexp // new Server(8080) | .listen(8080)
}

func NewJavaRegexes() *JavaRegexes {
	return &JavaRegexes{
		InlineEnv:      regexp.MustCompile(`(?i)\bPORT\s*=\s*(\d{2,5})\b.*\bjava\b`),
		SpringFlag:     regexp.MustCompile(`--server\.port\s*=\s*(\d{2,5})`),
		SystemProperty: regexp.MustCompile(`-Dserver\.port\s*=\s*(\d{2,5})`),
		PropsFile:      regexp.MustCompile(`(?m)^\s*server\.port\s*[:=]\s*(\d{2,5})\s*$`),
		YamlPort:       regexp.MustCompile(`(?mi)^\s*server(?:\.\w+)?\.?port\s*[:=]\s*(\d{2,5})\s*$`),
		ListenLiteral:  regexp.MustCompile(`\b(?:Server|listen)\s*\(\s*(\d{2,5})\s*\)`),
	}
}

var javaRe = NewJavaRegexes()

/* ------------------------------------------------------------------
   Walk *.java, *.kt, *.groovy, Dockerfile, *.sh, *.properties, *.yml…
   -----------------------------------------------------------------*/

func (pd *PortDetector) scanJavaFiles(root string) (*int, error) {
	var port *int

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		if d.IsDir() {
			if strings.HasPrefix(d.Name(), ".") ||
				d.Name() == "target" || d.Name() == "build" || d.Name() == ".gradle" {
				return filepath.SkipDir
			}
			return nil
		}

		ext := filepath.Ext(path)
		if ext != ".java" && ext != ".kt" && ext != ".groovy" &&
			ext != ".sh" && ext != ".cmd" && ext != ".bat" &&
			ext != ".properties" && ext != ".yml" && ext != ".yaml" &&
			d.Name() != "Dockerfile" && d.Name() != "Procfile" {
			return nil
		}

		b, _ := os.ReadFile(path)
		txt := string(b)

		switch {
		case matchPort(txt, javaRe.InlineEnv, &port):
		case matchPort(txt, javaRe.SpringFlag, &port):
		case matchPort(txt, javaRe.SystemProperty, &port):
		case matchPort(txt, javaRe.PropsFile, &port):
		case matchPort(txt, javaRe.YamlPort, &port):
		case matchPort(txt, javaRe.ListenLiteral, &port):
		default:
			return nil
		}

		if port != nil {
			return fs.SkipAll // first proven port wins
		}
		return nil
	})

	if err != nil && err != fs.SkipAll {
		return nil, err
	}
	return port, nil
}
