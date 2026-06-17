// portdetector/php.go
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

// DetectPHPPort inspects a PHP repo and returns the first *explicit*
// port number it can prove.  If nothing matches you get (nil, nil);
// the caller should then fall back (Laravel default = 8000).
func (pd *PortDetector) DetectPHPPort(root string) (*int, error) {
	return pd.scanPHPFiles(root)
}

/* ------------------------------------------------------------------
   Regex catalogue (mirrors the struct pattern you’re using)
   -----------------------------------------------------------------*/

type PHPRegexes struct {
	InlineEnv     *regexp.Regexp // PORT=9000 php …
	ArtisanServe  *regexp.Regexp // php artisan serve --port=9000
	BuiltinServer *regexp.Regexp // php -S 0.0.0.0:9000 -t public
	EnvAssign     *regexp.Regexp // $_ENV['PORT']  =  '9000'
	ListenLiteral *regexp.Regexp // ->listen(9000)  |  ->run('0.0.0.0', 9000)
	EnvFilePort   *regexp.Regexp // APP_PORT=9000  (Laravel .env)
}

func NewPHPRegexes() *PHPRegexes {
	return &PHPRegexes{
		InlineEnv:     regexp.MustCompile(`(?i)\bPORT\s*=\s*(\d{2,5})\b.*\bphp\b`),
		ArtisanServe:  regexp.MustCompile(`(?i)artisan\s+serve[^\\\n]*?--port\s*=?\s*(\d{2,5})`),
		BuiltinServer: regexp.MustCompile(`(?i)php\s+-S\s+\S*:(\d{2,5})`),
		EnvAssign:     regexp.MustCompile(`\$_(?:ENV|SERVER)\s*\[\s*['"]PORT['"]\s*]\s*=\s*['"]?(\d{2,5})['"]?`),
		ListenLiteral: regexp.MustCompile(`(?i)->(?:listen|run)\s*\([^)]*?(\d{2,5})`),
		EnvFilePort:   regexp.MustCompile(`(?m)^\s*APP_PORT\s*=\s*(\d{2,5})\s*$`),
	}
}

var phpRe = NewPHPRegexes()

/* ------------------------------------------------------------------
   Walk *.php / .env / Dockerfile / shell scripts
   -----------------------------------------------------------------*/

func (pd *PortDetector) scanPHPFiles(root string) (*int, error) {
	var port *int

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		if d.IsDir() {
			if strings.HasPrefix(d.Name(), ".") || d.Name() == "vendor" {
				return filepath.SkipDir
			}
			return nil
		}

		ext := filepath.Ext(path)
		if ext != ".php" && ext != ".sh" && ext != ".env" &&
			d.Name() != "Dockerfile" && d.Name() != "Procfile" {
			return nil
		}

		data, _ := os.ReadFile(path)
		txt := string(data)

		switch {
		case matchPort(txt, phpRe.InlineEnv, &port):
		case matchPort(txt, phpRe.ArtisanServe, &port):
		case matchPort(txt, phpRe.BuiltinServer, &port):
		case matchPort(txt, phpRe.EnvAssign, &port):
		case matchPort(txt, phpRe.ListenLiteral, &port):
		case matchPort(txt, phpRe.EnvFilePort, &port):
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
