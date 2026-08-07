#!/bin/sh
set -eu
OUT=".pma/implementation/smart-adaptive-dashboard-stage-a-ci/$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
{
  echo "# Smart Dashboard Stage A CI Evidence"
  echo
  echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "## Git"
  git status --short || true
  echo
  echo "## Compose Config"
  docker compose -f docker-compose.yml -f docker-compose.stage-a.yml config >/tmp/smart-stage-a-compose.yml 2>/tmp/smart-stage-a-compose.err || true
  if [ -f /tmp/smart-stage-a-compose.yml ]; then echo "compose_config_rendered.yml created"; fi
} > "$OUT/REPORT.md"
cp /tmp/smart-stage-a-compose.yml "$OUT/compose_config_rendered.yml" 2>/dev/null || true
cp /tmp/smart-stage-a-compose.err "$OUT/compose_config_errors.txt" 2>/dev/null || true
git status --short > "$OUT/git_status.txt" 2>/dev/null || true
git diff --stat > "$OUT/git_diff_stat.txt" 2>/dev/null || true
printf '%s\n' "$OUT/REPORT.md" > "$OUT/REPORT_PATH.txt"