package web

import "embed"

// distFS holds the compiled SPA. The image build overwrites dist/ with the real
// Vite output (apps/web/dist); the committed index.html is a stub so this package
// builds and tests without a web build present.
//
//go:embed all:dist
var distFS embed.FS
