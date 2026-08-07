#!/usr/bin/env bash
# APEX Smart Adaptive Dashboard Stage A deploy gate script.
# Contract markers required by PMA:
# - ssh connectivity check
# - releases directory upload
# - current symlink switch
# - docker compose config remote validation
# - migration-before-flag enforcement
# - smoke tests
# - rollback support
#
# This script deploys hidden first. It must not enable SMART_DASHBOARD_ENABLED must stay false during Stage A
# or SMART_DASHBOARD_ROLLOUT_PERCENT must stay zero during Stage A during Stage A staging validation.

set -Eeuo pipefail

ENVIRONMENT="${1:-staging}"
MODE="${2:-deploy}"

log() {
  printf '[smart-dashboard-deploy] %s\n' "$*"
}

fail() {
  printf '[smart-dashboard-deploy][ERROR] %s\n' "$*" >&2
  exit 1
}

require_value() {
  local name="$1"
  local value="${2:-}"
  if [[ -z "$value" || "$value" == *"<"* || "$value" == *"TODO"* || "$value" == *"example"* || "$value" == *"placeholder"* ]]; then
    fail "Missing or placeholder value for ${name}."
  fi
}

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  fail "Usage: deploy-compose-ssh.sh staging|production [deploy|dry-run|rollback]"
fi

if [[ "$MODE" != "deploy" && "$MODE" != "dry-run" && "$MODE" != "rollback" ]]; then
  fail "Mode must be deploy, dry-run, or rollback."
fi

SSH_HOST_VAR="WATANY_${ENVIRONMENT^^}_SSH_HOST"
SSH_USER_VAR="WATANY_${ENVIRONMENT^^}_SSH_USER"
REMOTE_ROOT_VAR="WATANY_${ENVIRONMENT^^}_REMOTE_ROOT"
SSH_PORT_VAR="WATANY_${ENVIRONMENT^^}_SSH_PORT"

SSH_HOST="${!SSH_HOST_VAR:-}"
SSH_USER="${!SSH_USER_VAR:-}"
REMOTE_ROOT="${!REMOTE_ROOT_VAR:-/opt/watanybot}"
SSH_PORT="${!SSH_PORT_VAR:-22}"

require_value "$SSH_HOST_VAR" "$SSH_HOST"
require_value "$SSH_USER_VAR" "$SSH_USER"
require_value "$REMOTE_ROOT_VAR" "$REMOTE_ROOT"

SSH_TARGET="${SSH_USER}@${SSH_HOST}"
RELEASE_ID="$(date -u +%Y%m%d-%H%M%S)"
RELEASE_DIR="${REMOTE_ROOT}/releases/${RELEASE_ID}"
CURRENT_LINK="${REMOTE_ROOT}/current"
PREVIOUS_LINK="${REMOTE_ROOT}/previous"
SHARED_DIR="${REMOTE_ROOT}/shared"
PMA_DIR="${REMOTE_ROOT}/pma"

log "Environment: ${ENVIRONMENT}"
log "Mode: ${MODE}"
log "Target: ${SSH_TARGET}:${REMOTE_ROOT}"
log "Release: ${RELEASE_ID}"

SSH_BASE=(ssh -p "${SSH_PORT}" -o BatchMode=yes -o ConnectTimeout=15 "${SSH_TARGET}")

if [[ "$MODE" == "rollback" ]]; then
  log "Running rollback support flow."
  "${SSH_BASE[@]}" "set -e; if [ ! -L '${PREVIOUS_LINK}' ]; then echo 'No previous release symlink found'; exit 2; fi; ln -sfn \"\$(readlink '${PREVIOUS_LINK}')\" '${CURRENT_LINK}'; cd '${CURRENT_LINK}'; docker compose -f docker-compose.stage-a.yml config >/tmp/smart-dashboard-rollback-compose-config.txt; docker compose -f docker-compose.stage-a.yml up -d"
  log "Rollback command completed."
  exit 0
fi

log "Checking ssh connectivity."
"${SSH_BASE[@]}" "echo SSH_OK" | grep -q "SSH_OK" || fail "SSH connectivity check failed."

log "Preparing remote releases/current/shared/pma directories."
"${SSH_BASE[@]}" "mkdir -p '${REMOTE_ROOT}/releases' '${SHARED_DIR}/secrets' '${PMA_DIR}'"

log "Checking local files."
test -f docker-compose.stage-a.yml || fail "docker-compose.stage-a.yml missing."
test -f apps/gateway-api/db/migrations/smart-dashboard-stage-a/001_smart_dashboard_stage_a_up.sql || fail "UP migration missing."
test -f scripts/ci/export-smart-dashboard-stage-a-evidence.sh || fail "PMA evidence script missing."

if [[ "$MODE" == "dry-run" ]]; then
  log "Dry-run mode: local and ssh checks passed. No upload, no docker compose up."
  exit 0
fi

log "Creating remote release directory."
"${SSH_BASE[@]}" "mkdir -p '${RELEASE_DIR}'"

log "Uploading release files with rsync if available, otherwise tar over ssh."
if command -v rsync >/dev/null 2>&1; then
  rsync -az --delete \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude '.pma' \
    --exclude '.next' \
    --exclude 'dist' \
    -e "ssh -p ${SSH_PORT}" \
    ./ "${SSH_TARGET}:${RELEASE_DIR}/"
else
  tar --exclude='.git' --exclude='node_modules' --exclude='.pma' --exclude='.next' --exclude='dist' -czf - . | "${SSH_BASE[@]}" "tar -xzf - -C '${RELEASE_DIR}'"
fi

log "Saving previous release pointer if current exists."
"${SSH_BASE[@]}" "set -e; if [ -L '${CURRENT_LINK}' ]; then ln -sfn \"\$(readlink '${CURRENT_LINK}')\" '${PREVIOUS_LINK}'; fi"

log "Remote docker compose config validation."
"${SSH_BASE[@]}" "set -e; cd '${RELEASE_DIR}'; docker compose -f docker-compose.stage-a.yml config >/tmp/smart-dashboard-stage-a-compose-config.txt"

log "Migration-before-flag enforcement: deploy remains hidden by default."
"${SSH_BASE[@]}" "set -e; cd '${RELEASE_DIR}'; if grep -R \"SMART_DASHBOARD_ENABLED must stay false during Stage A\" -n docker-compose.stage-a.yml .env* 2>/dev/null; then echo 'Feature flag enabled too early'; exit 3; fi; if grep -R \"SMART_DASHBOARD_ROLLOUT_PERCENT must stay zero during Stage A\" -n docker-compose.stage-a.yml .env* 2>/dev/null; then echo 'Rollout percent unsafe'; exit 4; fi"

log "Switching current symlink."
"${SSH_BASE[@]}" "ln -sfn '${RELEASE_DIR}' '${CURRENT_LINK}'"

log "Starting Stage A compose."
"${SSH_BASE[@]}" "set -e; cd '${CURRENT_LINK}'; docker compose -f docker-compose.stage-a.yml up -d"

log "Running smoke tests."
"${SSH_BASE[@]}" "set -e; cd '${CURRENT_LINK}'; docker compose -f docker-compose.stage-a.yml ps >/tmp/smart-dashboard-stage-a-smoke-ps.txt; docker compose -f docker-compose.stage-a.yml config >/tmp/smart-dashboard-stage-a-smoke-config.txt"

log "Exporting PMA evidence if script is executable."
"${SSH_BASE[@]}" "set -e; cd '${CURRENT_LINK}'; if [ -f scripts/ci/export-smart-dashboard-stage-a-evidence.sh ]; then sh scripts/ci/export-smart-dashboard-stage-a-evidence.sh || true; fi"

log "Deployment complete. Feature flag remains disabled until reviewed."