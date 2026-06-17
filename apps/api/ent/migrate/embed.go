package migrate

import "embed"

// MigrationsFS holds the versioned goose SQL migrations, embedded into the binary
// so the runtime image needs no separate /app/migrations directory.
//
//go:embed migrations/*.sql
var MigrationsFS embed.FS
