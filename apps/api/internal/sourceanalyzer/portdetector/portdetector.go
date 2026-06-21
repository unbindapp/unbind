package portdetector

import (
	"github.com/unbindapp/unbind-api/internal/sourceanalyzer/enum"
)

type PortDetector struct {
	Provider  enum.Provider
	Framework enum.Framework
	SourceDir string
}

func (self *PortDetector) DetectPort() (*int, error) {
	var port *int
	switch self.Provider {
	case enum.Node, enum.Bun:
		port, _ = self.DetectNodePort(self.SourceDir)
	case enum.Deno:
		port, _ = self.DetectDenoPort(self.SourceDir)
	case enum.Python:
		port, _ = self.DetectPythonPort(self.SourceDir)
	case enum.Go:
		port, _ = self.DetectGoPort(self.SourceDir)
	case enum.Java:
		port, _ = self.DetectJavaPort(self.SourceDir)
	case enum.PHP:
		port, _ = self.DetectPHPPort(self.SourceDir)
	case enum.Ruby:
		port, _ = self.DetectRubyPort(self.SourceDir)
	case enum.Rust:
		port, _ = self.DetectRustPort(self.SourceDir)
	case enum.Elixir:
		port, _ = self.DetectElixirPort(self.SourceDir)
	}

	if port == nil {
		// Infer only for some frameworks
		switch self.Framework {
		// Node
		case enum.Next, enum.CRA, enum.Express, enum.Hono, enum.Remix, enum.TanstackStart:
			port = new(3000)
		case enum.Astro:
			port = new(4321)
		case enum.Vite, enum.Sveltekit, enum.Solid:
			port = new(5173)
		case enum.Angular:
			port = new(4200)
		case enum.Expo:
			port = new(8081)
		// Python
		case enum.Django:
			port = new(8000)
		case enum.Flask:
			port = new(5000)
		case enum.FastAPI:
			port = new(8000)
		case enum.FastHTML:
			port = new(8000)
		// Java
		case enum.SpringBoot:
			port = new(8080)
		// PHP
		case enum.Laravel:
			port = new(8000)
		// Ruby
		case enum.Rails:
			port = new(3000)
		// Rust
		case enum.Rocket:
			port = new(8000)
		}
	}

	return port, nil
}
