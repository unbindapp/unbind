#!/usr/bin/env bash
# Regenerate the web's client types from the API code in the working tree.
# Builds the OpenAPI spec offline (no running server) and feeds it to the web
# client generator.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPEC="$(mktemp -t unbind-openapi.XXXXXX.yaml)"
trap 'rm -f "$SPEC"' EXIT

echo "Generating OpenAPI spec from apps/api..."
(cd "$ROOT/apps/api" && go run ./cmd/openapi) >"$SPEC"

echo "Generating web client from spec..."
(cd "$ROOT/apps/web" && bun run ./scripts/generate-go-client/main.ts -i "$SPEC")

echo "Done."
