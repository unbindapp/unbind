#!/usr/bin/env bash
# Regenerate the data the docs render from the API code in the working tree:
# the OpenAPI spec and the template definitions. Pass a directory to write
# somewhere other than apps/docs/generated.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$ROOT/apps/docs/generated}"

mkdir -p "$OUT"
(cd "$ROOT/apps/api" && go run ./cmd/openapi -api-key-only) >"$OUT/openapi.gen.yaml"
(cd "$ROOT/apps/api" && go run ./cmd/templates) >"$OUT/templates.gen.json"

echo "Wrote docs data to $OUT"
