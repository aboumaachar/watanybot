#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"
exec node ./node_modules/next/dist/bin/next start --port 4100