// portdetector/rust.go
package portdetector

import (
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

// DetectRustPort returns the first **explicit** port number it can
// prove in a Rust repo. If nothing matches you get (nil, nil); the
// caller should then fall back (Rocket default = 8000).
func (pd *PortDetector) DetectRustPort(root string) (*int, error) {
	return pd.scanRustFiles(root)
}

/* ------------------------------------------------------------------
   Regex catalogue  (one struct per language, per your pattern)
   -----------------------------------------------------------------*/

type RustRegexes struct {
	InlineEnv      *regexp.Regexp // PORT=9000 cargo run
	RocketEnv      *regexp.Regexp // ROCKET_PORT=9000 cargo run
	BindLiteral    *regexp.Regexp // .bind("0.0.0.0:9000")
	BindTuple      *regexp.Regexp // .bind(("0.0.0.0", 9000))
	RunLiteral     *regexp.Regexp // .run(([0,0,0,0], 7000))
	ConfigPort     *regexp.Regexp // port: 8000  in Rocket::Config { … }
	RocketTomlPort *regexp.Regexp // port = 8000  in Rocket.toml
	ClapDefault    *regexp.Regexp // Arg::with_name("port").default_value("8000")
	OptOptDefault  *regexp.Regexp // optopt("p", "port", …, "8000")
	VarAssign      *regexp.Regexp // let port = "7878";
	ListenVar      *regexp.Regexp // .listen(host, port)
}

func NewRustRegexes() *RustRegexes {
	return &RustRegexes{
		InlineEnv: regexp.MustCompile(`(?i)\bPORT\s*=\s*(\d{2,5})\b.*\bcargo\b`),
		RocketEnv: regexp.MustCompile(`(?i)\bROCKET_PORT\s*=\s*(\d{2,5})\b`),
		BindLiteral: regexp.MustCompile(
			`\.bind\(\s*["'][^"']*:(\d{2,5})["']`),
		BindTuple: regexp.MustCompile(
			`\.bind\(\s*\([^)]*,\s*(\d{2,5})\s*\)`),
		RunLiteral: regexp.MustCompile(
			`\.run\(\s*\([^)]*,\s*(\d{2,5})\s*\)`),
		ConfigPort: regexp.MustCompile(
			`(?i)\bport\s*:\s*(\d{2,5})`),
		RocketTomlPort: regexp.MustCompile(
			`(?m)^\s*port\s*=\s*(\d{2,5})\s*$`),
		ClapDefault: regexp.MustCompile(
			`(?is)with_name\(\s*["']port["']\s*\).*?default_value\(\s*["'](\d{2,5})["']\s*\)`),
		OptOptDefault: regexp.MustCompile(
			`(?is)\.optopt\([^)]*?"port"[^)]*?["'](\d{2,5})["']\s*\)`),
		VarAssign: regexp.MustCompile(
			`(?m)\blet\s+(\w+)\s*=\s*"\s*(\d{2,5})\s*"\s*;`),
		ListenVar: regexp.MustCompile(
			`(?m)\.\s*listen\s*\([^,]*,\s*(\w+)\s*\)`),
	}
}

var rustRe = NewRustRegexes()

/* ------------------------------------------------------------------
   Walk *.rs / Rocket.toml / shell scripts / Dockerfile / .env
   -----------------------------------------------------------------*/

func (pd *PortDetector) scanRustFiles(root string) (*int, error) {
	var port *int

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		if d.IsDir() {
			if strings.HasPrefix(d.Name(), ".") || d.Name() == "target" {
				return filepath.SkipDir
			}
			return nil
		}

		ext := filepath.Ext(path)
		if ext != ".rs" && ext != ".sh" && ext != ".env" && ext != ".toml" &&
			d.Name() != "Dockerfile" && d.Name() != "Procfile" && d.Name() != "Rocket.toml" {
			return nil
		}

		data, _ := os.ReadFile(path)
		txt := string(data)

		// gather variable→port bindings first
		vars := make(map[string]int)
		for _, m := range rustRe.VarAssign.FindAllStringSubmatch(txt, -1) {
			if len(m) == 3 {
				if p, err := strconv.Atoi(m[2]); err == nil {
					vars[m[1]] = p // var name → port
				}
			}
		}

		switch {
		case matchPort(txt, rustRe.InlineEnv, &port):
		case matchPort(txt, rustRe.RocketEnv, &port):
		case matchPort(txt, rustRe.BindLiteral, &port):
		case matchPort(txt, rustRe.BindTuple, &port):
		case matchPort(txt, rustRe.RunLiteral, &port):
		case matchPort(txt, rustRe.ConfigPort, &port):
		case matchPort(txt, rustRe.RocketTomlPort, &port):
		case matchPort(txt, rustRe.ClapDefault, &port):
		case matchPort(txt, rustRe.OptOptDefault, &port):
		default:
			if m := rustRe.ListenVar.FindStringSubmatch(txt); len(m) == 2 {
				if p, ok := vars[m[1]]; ok && p != 0 {
					tmp := p
					port = &tmp
				}
			}
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
