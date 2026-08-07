#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

# Load simple KEY=VALUE pairs from .env without depending on shell-specific tooling.
if [ -f .env ]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    key=$(echo "$key" | xargs)
    [[ "$key" =~ " " ]] && continue
    export "$key=$value"
  done < .env
fi

server_full="$PWD/src/server.ts"
if [ ! -f "$server_full" ] && [ -f "$PWD/apps/gateway-api/src/server.ts" ]; then
  server_full="$PWD/apps/gateway-api/src/server.ts"
fi

# Prefer pinned node binary when provided (WATANY_NODE_BIN), fall back to `node` on PATH
node_bin="${WATANY_NODE_BIN:-$(command -v node || true)}"
if [ -z "$node_bin" ]; then
  echo "No node binary found in WATANY_NODE_BIN or PATH" >&2
  exit 1
fi

exec "$node_bin" --env-file=.env --import tsx "$server_full"