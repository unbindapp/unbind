#!/usr/bin/env bash
# Fails if the docs data is out of sync with the API code. Generates it into a
# temp directory and diffs it against the committed one.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMMITTED="$ROOT/apps/docs/generated"
GENERATED="$(mktemp -d -t unbind-docs-data.XXXXXX)"
trap 'rm -rf "$GENERATED"' EXIT

"$ROOT/scripts/gen-docs-data.sh" "$GENERATED" >/dev/null

if ! diff -rq "$COMMITTED" "$GENERATED" >/dev/null 2>&1; then
	echo "✘ Docs data is out of sync with the API."
	echo "  Run ./scripts/gen-docs-data.sh and commit apps/docs/generated"
	exit 1
fi
