#!/bin/sh
set -eu

# Render canonical support roles (agents/) into Claude Code and Codex.
# Dry run by default; --apply installs a reviewed plan. See --help.

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "link-agents: node is required" >&2
  exit 1
fi

if [ ! -d "$ROOT/node_modules/yaml" ] || [ ! -d "$ROOT/node_modules/smol-toml" ]; then
  echo "link-agents: parser dependencies are missing; run: (cd \"$ROOT\" && npm ci)" >&2
  exit 1
fi

exec node "$ROOT/bin/lib/render-agents.mjs" "$@"
