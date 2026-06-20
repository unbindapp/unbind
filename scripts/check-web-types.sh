#!/usr/bin/env bash
# Fails if the web's client types are out of sync with the API code. Generates
# the spec and client into a temp file and diffs it against the committed one.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMMITTED="$ROOT/apps/web/src/lib/server/client.gen.ts"
SPEC="$(mktemp -t unbind-openapi.XXXXXX.yaml)"
GENERATED="$(mktemp -t unbind-client.XXXXXX.ts)"
trap 'rm -f "$SPEC" "$GENERATED"' EXIT

(cd "$ROOT/apps/api" && go run ./cmd/openapi) >"$SPEC"
(cd "$ROOT/apps/web" && bun run ./scripts/generate-go-client/main.ts -i "$SPEC" -o "$GENERATED") >/dev/null

if ! diff -q "$COMMITTED" "$GENERATED" >/dev/null 2>&1; then
	echo "✘ Web client types are out of sync with the API."
	echo "  Run ./scripts/gen-web-types.sh and commit apps/web/src/lib/server/client.gen.ts"
	exit 1
fi
