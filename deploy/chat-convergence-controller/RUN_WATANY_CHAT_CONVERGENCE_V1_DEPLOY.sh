#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
ST='/home/dcagent/watany-staging/chat-convergence-v1'
CURRENT_LINK='/opt/watany/current'
EXPECTED_CURRENT="$(cat "$ST/EXPECTED_CURRENT.txt")"
WEB_LIVE='/home/koudama/public_html'
BASE='http://127.0.0.1:8015'
NODE='/home/dcagent/.nvm/versions/node/v24.21.0/bin/node'
PNPM='/usr/local/bin/pnpm'
PM2='/usr/local/bin/pm2'
RUN_ID="chat-convergence-v1-$(date -u +%Y%m%dT%H%M%SZ)-$$"
RELEASE="/opt/watany/releases/$RUN_ID"
EVIDENCE="$ST/evidence/$RUN_ID"
OLD_CURRENT=''
CURRENT_SWITCHED=0
WEB_MUTATED=0
GATEWAY_RESTARTED=0
MIGRATIONS_APPLIED=0
mkdir -p "$EVIDENCE"
for f in FINAL_REPORT.md summary.json FINAL_STATUS.txt progress.json progress.csv checkpoint.json validations.csv actions.csv failures.csv warnings.csv ERROR_LOG.txt EXECUTION_LOG.txt stage_preflight.txt stage_release.txt stage_migration.txt stage_cutover.txt stage_runtime.txt stage_browser.txt; do
  : > "$EVIDENCE/$f"
done
for f in stage_preflight.txt stage_release.txt stage_migration.txt stage_cutover.txt stage_runtime.txt stage_browser.txt; do
  printf '%s\n' 'NOT_STARTED' > "$EVIDENCE/$f"
done
printf '%s\n' 'RUNNING' > "$EVIDENCE/FINAL_STATUS.txt"
printf '%s\n' 'APEX_PS1_SKILL_UPDATE_NOT_REQUIRED' | tee -a "$EVIDENCE/EXECUTION_LOG.txt"
printf '%s\n' 'stage,status,detail' > "$EVIDENCE/progress.csv"
printf '%s\n' 'validation,status,detail' > "$EVIDENCE/validations.csv"
printf '%s\n' 'action,status,detail' > "$EVIDENCE/actions.csv"
printf '%s\n' 'failure,detail' > "$EVIDENCE/failures.csv"
printf '%s\n' 'warning,detail' > "$EVIDENCE/warnings.csv"
printf '{"stage":"bootstrap","status":"RUNNING"}\n' > "$EVIDENCE/progress.json"
printf '{"runId":"%s","release":"%s","status":"RUNNING","stage":"bootstrap"}\n' "$RUN_ID" "$RELEASE" > "$EVIDENCE/checkpoint.json"
printf '{"status":"RUNNING","runId":"%s","release":"%s"}\n' "$RUN_ID" "$RELEASE" > "$EVIDENCE/summary.json"
printf '# Watany Chat Convergence V1 Deployment\n\nStatus: RUNNING\n' > "$EVIDENCE/FINAL_REPORT.md"
log(){ printf '%s\n' "$*" | tee -a "$EVIDENCE/EXECUTION_LOG.txt"; }
record_progress(){
  printf '%s,%s,%s\n' "$1" "$2" "${3:-}" >> "$EVIDENCE/progress.csv"
  printf '{"stage":"%s","status":"%s","detail":"%s"}\n' "$1" "$2" "${3:-}" > "$EVIDENCE/progress.json"
  printf '{"runId":"%s","release":"%s","status":"%s","stage":"%s"}\n' "$RUN_ID" "$RELEASE" "$2" "$1" > "$EVIDENCE/checkpoint.json"
}
seal_report(){
  cd "$EVIDENCE"
  rm -f REPORT_MANIFEST.sha256 report-manifest.stdout.txt report-manifest.stderr.txt
  mapfile -t report_files < <(find . -maxdepth 1 -type f ! -name 'REPORT_MANIFEST.sha256' ! -name 'report-manifest.stdout.txt' ! -name 'report-manifest.stderr.txt' -printf '%P\n' | sort)
  [ "${#report_files[@]}" -gt 0 ] || return 3
  sha256sum "${report_files[@]}" > REPORT_MANIFEST.sha256
  sha256sum -c REPORT_MANIFEST.sha256 > report-manifest.stdout.txt 2> report-manifest.stderr.txt
  [ ! -s report-manifest.stderr.txt ]
}
rollback(){
  local rb=0 health='000' ready='000' current_after=''
  set +e
  if [ "$WEB_MUTATED" -eq 1 ] && [ -n "$OLD_CURRENT" ]; then
    rsync -rltD --delete --chown=koudama:koudama --chmod=D755,F644 --exclude='.htaccess' --exclude='ads.txt' --exclude='ops/' --exclude='media/' --exclude='.well-known/' "$OLD_CURRENT/apps/web-user/dist/" "$WEB_LIVE/" > "$EVIDENCE/rollback-web.stdout.txt" 2> "$EVIDENCE/rollback-web.stderr.txt"
    if [ $? -ne 0 ] || [ -s "$EVIDENCE/rollback-web.stderr.txt" ] || ! cmp -s "$OLD_CURRENT/apps/web-user/dist/index.html" "$WEB_LIVE/index.html"; then
      printf '%s,%s\n' 'ROLLBACK_WEB_FAILED' 'web restore/parity failed' >> "$EVIDENCE/failures.csv"; rb=1
    else log 'ROLLBACK_WEB=PASS'; fi
  fi
  if [ "$CURRENT_SWITCHED" -eq 1 ] && [ -n "$OLD_CURRENT" ]; then
    ln -sfn "$OLD_CURRENT" "$CURRENT_LINK"
    [ $? -eq 0 ] || rb=1
    "$PM2" restart watany-gateway --update-env > "$EVIDENCE/rollback-pm2.stdout.txt" 2> "$EVIDENCE/rollback-pm2.stderr.txt"
    if [ $? -ne 0 ] || [ -s "$EVIDENCE/rollback-pm2.stderr.txt" ]; then rb=1; fi
    for attempt in $(seq 1 60); do
      health="$(curl -sS -o "$EVIDENCE/rollback-health.body" -w '%{http_code}' --max-time 2 "$BASE/health" 2> "$EVIDENCE/rollback-health.tmp")"; curl_rc=$?
      if [ "$curl_rc" -eq 0 ] && [ "$health" = '200' ] && [ ! -s "$EVIDENCE/rollback-health.tmp" ]; then break; fi
      sleep 1
    done
    rm -f "$EVIDENCE/rollback-health.tmp"
    ready="$(curl -sS -o "$EVIDENCE/rollback-ready.body" -w '%{http_code}' --max-time 15 "$BASE/ready" 2> "$EVIDENCE/rollback-ready.stderr.txt")"; ready_rc=$?
    current_after="$(readlink -f "$CURRENT_LINK" 2>/dev/null)"
    if [ "$current_after" != "$OLD_CURRENT" ] || [ "$health" != '200' ] || [ "$ready_rc" -ne 0 ] || [ "$ready" != '200' ] || [ -s "$EVIDENCE/rollback-ready.stderr.txt" ]; then rb=1; fi
  fi
  if [ "$MIGRATIONS_APPLIED" -eq 1 ]; then
    printf '%s,%s\n' 'ROLLBACK_MIGRATIONS_NOT_REVERTED' 'community migrations are additive/backward-compatible and remain applied' >> "$EVIDENCE/warnings.csv"
  fi
  if [ "$rb" -eq 0 ]; then log 'ROLLBACK_VERIFIED=PASS'; else log 'ROLLBACK_VERIFIED=FAIL'; fi
  set -e
  return "$rb"
}
fail(){
  local code="$1" detail="${2:-}" rollback_rc=0 seal_rc=0
  trap - ERR
  set +e
  printf '%s,%s\n' "$code" "$detail" >> "$EVIDENCE/failures.csv"
  printf '%s | %s\n' "$code" "$detail" >> "$EVIDENCE/ERROR_LOG.txt"
  rollback || rollback_rc=$?
  record_progress failure BLOCKED "$code"
  printf '%s\n' 'BLOCKED' > "$EVIDENCE/FINAL_STATUS.txt"
  printf '{"status":"BLOCKED","firstFailure":"%s","rollbackVerified":%s,"runId":"%s","release":"%s"}\n' "$code" "$([ "$rollback_rc" -eq 0 ] && printf true || printf false)" "$RUN_ID" "$RELEASE" > "$EVIDENCE/summary.json"
  printf '# Watany Chat Convergence V1 Deployment\n\nStatus: BLOCKED\n\nFirst failure: `%s`\n\nDetail: `%s`\n\nRollback verified: `%s`\n' "$code" "$detail" "$([ "$rollback_rc" -eq 0 ] && printf YES || printf NO)" > "$EVIDENCE/FINAL_REPORT.md"
  log 'PROGRAM_STATUS=BLOCKED'
  log "FIRST_FAILURE=$code"
  [ -n "$detail" ] && log "DETAIL=$detail"
  log "ROLLBACK_VERIFIED=$([ "$rollback_rc" -eq 0 ] && printf PASS || printf FAIL)"
  seal_report; seal_rc=$?
  printf 'REPORT_SEAL=%s\n' "$([ "$seal_rc" -eq 0 ] && printf PASS || printf FAIL)"
  printf 'REPORT_ROOT=%s\n' "$EVIDENCE"
  exit 1
}
on_err(){ local rc=$? line="$1"; fail UNHANDLED_ERROR "rc=$rc line=$line"; }
trap 'on_err $LINENO' ERR
[ "$(id -u)" -eq 0 ] || fail ROOT_REQUIRED
for exe in "$NODE" "$PNPM" "$PM2" /usr/bin/rsync /usr/bin/curl /usr/bin/sha256sum; do
  [ -x "$exe" ] || fail REQUIRED_EXECUTABLE_MISSING "$exe"
done
for required in OVERLAY_FILES.txt OVERLAY_MANIFEST.sha256 PROOF_MANIFEST.sha256 EXPECTED_CURRENT.txt BUNDLE_COMMIT.txt; do
  [ -f "$ST/$required" ] || fail PACKAGE_FILE_MISSING "$required"
done
OLD_CURRENT="$(readlink -f "$CURRENT_LINK")"
log "CURRENT=$OLD_CURRENT"
[ "$OLD_CURRENT" = "$EXPECTED_CURRENT" ] || fail SOURCE_AUTHORITY_DRIFT "$OLD_CURRENT"
[ -f "$OLD_CURRENT/apps/gateway-api/.env" ] || fail GATEWAY_ENV_MISSING
[ -f "$OLD_CURRENT/apps/gateway-api/src/db/migrations/049_wordpress_legacy_users.sql" ] || fail WORDPRESS_MIGRATION_MISSING
WORDPRESS_049_HASH="$(sha256sum "$OLD_CURRENT/apps/gateway-api/src/db/migrations/049_wordpress_legacy_users.sql" | awk '{print $1}')"
log "WORDPRESS_049_HASH=$WORDPRESS_049_HASH"
(cd "$ST/overlay" && sha256sum -c "$ST/OVERLAY_MANIFEST.sha256") > "$EVIDENCE/overlay-manifest.stdout.txt" 2> "$EVIDENCE/overlay-manifest.stderr.txt" || fail OVERLAY_MANIFEST_FAILED
[ ! -s "$EVIDENCE/overlay-manifest.stderr.txt" ] || fail OVERLAY_MANIFEST_STDERR_NONZERO
(cd "$ST/proofs" && sha256sum -c "$ST/PROOF_MANIFEST.sha256") > "$EVIDENCE/proof-manifest.stdout.txt" 2> "$EVIDENCE/proof-manifest.stderr.txt" || fail PROOF_MANIFEST_FAILED
[ ! -s "$EVIDENCE/proof-manifest.stderr.txt" ] || fail PROOF_MANIFEST_STDERR_NONZERO
for gate in gateway-typecheck web-typecheck web-build; do
  [ -f "$ST/evidence/$gate.rc" ] || fail PREDEPLOY_GATE_RC_MISSING "$gate"
  rc="$(tr -d '\r\n ' < "$ST/evidence/$gate.rc")"
  [ "$rc" = '0' ] || fail PREDEPLOY_GATE_NOT_GREEN "$gate:$rc"
  [ -f "$ST/evidence/$gate.err" ] || fail PREDEPLOY_GATE_ERR_MISSING "$gate"
  [ ! -s "$ST/evidence/$gate.err" ] || fail PREDEPLOY_GATE_STDERR_NONZERO "$gate"
  [ -s "$ST/evidence/$gate.out" ] || fail PREDEPLOY_GATE_OUTPUT_MISSING "$gate"
done
for ep in health ready; do
  if code="$(curl -sS -o "$EVIDENCE/pre-$ep.body" -w '%{http_code}' --max-time 15 "$BASE/$ep" 2> "$EVIDENCE/pre-$ep.stderr.txt")"; then
    curl_rc=0
  else
    curl_rc=$?
  fi
  [ "$curl_rc" -eq 0 ] || fail "PRE_${ep^^}_CURL_EXIT" "$curl_rc"
  [ ! -s "$EVIDENCE/pre-$ep.stderr.txt" ] || fail "PRE_${ep^^}_STDERR_NONZERO"
  [ "$code" = '200' ] || fail "PRE_${ep^^}_NOT_200" "$code"
done
[ -f "$OLD_CURRENT/apps/web-user/dist/index.html" ] || fail CURRENT_DIST_INDEX_MISSING
[ -f "$WEB_LIVE/index.html" ] || fail LIVE_WEBROOT_INDEX_MISSING
cmp -s "$OLD_CURRENT/apps/web-user/dist/index.html" "$WEB_LIVE/index.html" || fail LIVE_WEBROOT_INDEX_DRIFT
record_progress preflight PASS 'package, current authority, predeploy gates, health and webroot parity verified'
printf '%s\n' 'PASS' > "$EVIDENCE/stage_preflight.txt"
run_gate(){
  local name="$1"; shift
  local rc=0
  if "$@" > "$EVIDENCE/$name.out" 2> "$EVIDENCE/$name.err"; then
    rc=0
  else
    rc=$?
  fi
  printf '%s\n' "$rc" > "$EVIDENCE/$name.rc"
  if [ "$rc" -ne 0 ]; then
    fail "${name^^}_EXIT" "rc=$rc stderr=$EVIDENCE/$name.err"
  fi
  [ ! -s "$EVIDENCE/$name.err" ] || fail "${name^^}_STDERR_NONZERO" "$EVIDENCE/$name.err"
}
log '=== RELEASE MATERIALIZATION ==='
[ ! -e "$RELEASE" ] || fail RELEASE_ALREADY_EXISTS "$RELEASE"
mkdir -p "$RELEASE"
if rsync -a --link-dest="$OLD_CURRENT" "$OLD_CURRENT/" "$RELEASE/" > "$EVIDENCE/release-base-rsync.stdout.txt" 2> "$EVIDENCE/release-base-rsync.stderr.txt"; then
  rsync_rc=0
else
  rsync_rc=$?
fi
[ "$rsync_rc" -eq 0 ] || fail RELEASE_BASE_COPY_FAILED "$rsync_rc"
[ ! -s "$EVIDENCE/release-base-rsync.stderr.txt" ] || fail RELEASE_BASE_COPY_STDERR_NONZERO
rsync -a "$ST/overlay/" "$RELEASE/" > "$EVIDENCE/release-overlay.stdout.txt" 2> "$EVIDENCE/release-overlay.stderr.txt" || fail RELEASE_OVERLAY_FAILED
[ ! -s "$EVIDENCE/release-overlay.stderr.txt" ] || fail RELEASE_OVERLAY_STDERR_NONZERO
mkdir -p "$RELEASE/.pma/chat-convergence-proofs"
rsync -a "$ST/proofs/" "$RELEASE/.pma/chat-convergence-proofs/" > "$EVIDENCE/release-proofs.stdout.txt" 2> "$EVIDENCE/release-proofs.stderr.txt" || fail RELEASE_PROOFS_COPY_FAILED
[ ! -s "$EVIDENCE/release-proofs.stderr.txt" ] || fail RELEASE_PROOFS_COPY_STDERR_NONZERO
(cd "$RELEASE" && sha256sum -c "$ST/OVERLAY_MANIFEST.sha256") > "$EVIDENCE/release-overlay-manifest.stdout.txt" 2> "$EVIDENCE/release-overlay-manifest.stderr.txt" || fail RELEASE_OVERLAY_MANIFEST_FAILED
[ ! -s "$EVIDENCE/release-overlay-manifest.stderr.txt" ] || fail RELEASE_OVERLAY_MANIFEST_STDERR_NONZERO
(cd "$RELEASE/.pma/chat-convergence-proofs" && sha256sum -c "$ST/PROOF_MANIFEST.sha256") > "$EVIDENCE/release-proof-manifest.stdout.txt" 2> "$EVIDENCE/release-proof-manifest.stderr.txt" || fail RELEASE_PROOF_MANIFEST_FAILED
[ ! -s "$EVIDENCE/release-proof-manifest.stderr.txt" ] || fail RELEASE_PROOF_MANIFEST_STDERR_NONZERO
[ -f "$RELEASE/apps/gateway-api/src/db/migrations/049_wordpress_legacy_users.sql" ] || fail RELEASE_WORDPRESS_MIGRATION_MISSING
release_wp_hash="$(sha256sum "$RELEASE/apps/gateway-api/src/db/migrations/049_wordpress_legacy_users.sql" | awk '{print $1}')"
[ "$release_wp_hash" = "$WORDPRESS_049_HASH" ] || fail RELEASE_WORDPRESS_MIGRATION_DRIFT "$release_wp_hash"
if grep -q 'groupsRoutes' "$RELEASE/apps/gateway-api/src/bootstrap/routes.ts"; then fail LEGACY_GROUPS_AUTHORITY_REMAINED; fi
if grep -Rqs --include='*.ts' --include='*.tsx' 'useInternalMail(' "$RELEASE/apps/web-user/src/components"; then fail FAKE_INTERNAL_MAIL_CALLER_REMAINED; fi
rm -rf "$RELEASE/apps/web-user/node_modules/.vite" "$RELEASE/apps/gateway-api/node_modules/.vite"
cd "$RELEASE"
run_gate gateway-release-typecheck "$PNPM" --filter gateway-api typecheck
run_gate web-release-typecheck "$PNPM" --filter web-user typecheck
run_gate web-release-build "$PNPM" --filter web-user build
[ -f "$RELEASE/apps/web-user/dist/index.html" ] || fail RELEASE_DIST_INDEX_MISSING
printf '%s,%s,%s\n' 'gateway_typecheck' 'PASS' 'full root-readable release' >> "$EVIDENCE/validations.csv"
printf '%s,%s,%s\n' 'web_typecheck' 'PASS' 'full root-readable release' >> "$EVIDENCE/validations.csv"
printf '%s,%s,%s\n' 'web_build' 'PASS' 'production build' >> "$EVIDENCE/validations.csv"
printf '%s\n' 'PASS' > "$EVIDENCE/stage_release.txt"
record_progress release PASS "$RELEASE"
log '=== MIGRATIONS ==='
cd "$RELEASE/apps/gateway-api"
run_gate release-migrate "$NODE" --env-file=.env --import tsx src/db/migrate.ts
grep -q '\[migrate\] all migrations applied' "$EVIDENCE/release-migrate.out" || fail MIGRATION_SUCCESS_TOKEN_MISSING
if grep -Eqi 'FATAL|ERROR|failed|exception' "$EVIDENCE/release-migrate.out"; then fail MIGRATION_FAILURE_TOKEN_PRESENT; fi
MIGRATIONS_APPLIED=1
for mig in 049_community_message_attachment_position.sql 050_community_message_stars_text_identity.sql 051_community_direct_conversations.sql; do
  [ -f "$RELEASE/apps/gateway-api/src/db/migrations/$mig" ] || fail CHAT_MIGRATION_FILE_MISSING "$mig"
done
printf '%s,%s,%s\n' 'chat_migrations' 'PASS' 'runner completed all migration filenames' >> "$EVIDENCE/validations.csv"
printf '%s\n' 'PASS' > "$EVIDENCE/stage_migration.txt"
record_progress migration PASS 'additive chat migrations applied/confirmed'
log '=== CUTOVER ==='
ln -sfn "$RELEASE" "$CURRENT_LINK" || fail CURRENT_SWITCH_FAILED
CURRENT_SWITCHED=1
"$PM2" restart watany-gateway --update-env > "$EVIDENCE/pm2-restart.stdout.txt" 2> "$EVIDENCE/pm2-restart.stderr.txt" || fail PM2_RESTART_FAILED
[ ! -s "$EVIDENCE/pm2-restart.stderr.txt" ] || fail PM2_RESTART_STDERR_NONZERO
GATEWAY_RESTARTED=1
health_code='000'; health_rc=1
for attempt in $(seq 1 60); do
  if health_code="$(curl -sS -o "$EVIDENCE/post-health.body" -w '%{http_code}' --max-time 2 "$BASE/health" 2> "$EVIDENCE/post-health.tmp")"; then
    health_rc=0
  else
    health_rc=$?
  fi
  if [ "$health_rc" -eq 0 ] && [ "$health_code" = '200' ] && [ ! -s "$EVIDENCE/post-health.tmp" ]; then rm -f "$EVIDENCE/post-health.tmp"; break; fi
  sleep 1
done
[ "$health_rc" -eq 0 ] || fail POST_HEALTH_CURL_EXIT "$health_rc"
[ "$health_code" = '200' ] || fail POST_HEALTH_NOT_200 "$health_code"
if ready_code="$(curl -sS -o "$EVIDENCE/post-ready.body" -w '%{http_code}' --max-time 15 "$BASE/ready" 2> "$EVIDENCE/post-ready.stderr.txt")"; then
  ready_rc=0
else
  ready_rc=$?
fi
[ "$ready_rc" -eq 0 ] || fail POST_READY_CURL_EXIT "$ready_rc"
[ ! -s "$EVIDENCE/post-ready.stderr.txt" ] || fail POST_READY_STDERR_NONZERO
[ "$ready_code" = '200' ] || fail POST_READY_NOT_200 "$ready_code"
pm2_pid="$("$PM2" pid watany-gateway | tr -d '\r\n ')"
[[ "$pm2_pid" =~ ^[0-9]+$ ]] || fail PM2_PID_INVALID "$pm2_pid"
pm2_cwd="$(readlink -f "/proc/$pm2_pid/cwd" 2>/dev/null || true)"
log "PM2_PID=$pm2_pid"
log "PM2_CWD=$pm2_cwd"
case "$pm2_cwd" in "$RELEASE"/apps/gateway-api|"$RELEASE"/apps/gateway-api/) ;; *) fail PM2_RELEASE_CWD_MISMATCH "$pm2_cwd" ;; esac
WEB_MUTATED=1
rsync -rltD --delete --chown=koudama:koudama --chmod=D755,F644 --exclude='.htaccess' --exclude='ads.txt' --exclude='ops/' --exclude='media/' --exclude='.well-known/' "$RELEASE/apps/web-user/dist/" "$WEB_LIVE/" > "$EVIDENCE/web-rsync.stdout.txt" 2> "$EVIDENCE/web-rsync.stderr.txt" || fail WEB_RSYNC_FAILED
[ ! -s "$EVIDENCE/web-rsync.stderr.txt" ] || fail WEB_RSYNC_STDERR_NONZERO
cmp -s "$RELEASE/apps/web-user/dist/index.html" "$WEB_LIVE/index.html" || fail LIVE_INDEX_MISMATCH
[ "$(readlink -f "$CURRENT_LINK")" = "$RELEASE" ] || fail CURRENT_LINK_POSTCUTOVER_MISMATCH
printf '%s\n' 'PASS' > "$EVIDENCE/stage_cutover.txt"
record_progress cutover PASS 'current symlink, root PM2 gateway and public webroot switched'
log '=== RUNTIME AUTHORITY ==='
check_http(){
  local name="$1" expected="$2" url="$3" code rc
  if code="$(curl -sS -o "$EVIDENCE/$name.body" -w '%{http_code}' --max-time 20 "$url" 2> "$EVIDENCE/$name.stderr.txt")"; then
    rc=0
  else
    rc=$?
  fi
  log "${name}_HTTP=$code"
  [ "$rc" -eq 0 ] || fail "${name}_CURL_EXIT" "$rc"
  [ ! -s "$EVIDENCE/$name.stderr.txt" ] || fail "${name}_STDERR_NONZERO"
  [ "$code" = "$expected" ] || fail "${name}_HTTP_MISMATCH" "$code expected=$expected"
}
check_http LEGACY_GROUPS 404 "$BASE/api/groups"
check_http COMMUNITY_GROUPS 200 "$BASE/api/community/groups"
check_http DIRECT_UNAUTH 401 "$BASE/api/community/direct"
check_http DIRECT_CONTACTS_UNAUTH 401 "$BASE/api/community/direct/contacts"
check_http PUBLIC_CHAT 200 'https://koudama.com/chat'
check_http PUBLIC_MESSAGES 200 'https://koudama.com/messages'
check_http PUBLIC_MCP_HEALTH 200 'https://koudama.com/mcp/health'
printf '%s,%s,%s\n' 'route_authority' 'PASS' 'legacy 404, community 200, direct auth 401' >> "$EVIDENCE/validations.csv"
printf '%s\n' 'PASS' > "$EVIDENCE/stage_runtime.txt"
record_progress runtime PASS 'internal and public route authority verified'
assert_proof(){
  local name="$1"
  [ -s "$EVIDENCE/$name.out" ] || fail "${name^^}_OUTPUT_MISSING"
  [ ! -s "$EVIDENCE/$name.err" ] || fail "${name^^}_STDERR_NONZERO"
  grep -q '"status": "PASS"' "$EVIDENCE/$name.out" || fail "${name^^}_PASS_TOKEN_MISSING"
  if grep -Eqi '"status": "FAIL"|FATAL|fatal=' "$EVIDENCE/$name.out"; then fail "${name^^}_FAILURE_TOKEN_PRESENT"; fi
}
log '=== LIVE CHAT PROOFS ==='
if runuser -u dcagent -- env HOME=/home/dcagent PLAYWRIGHT_BROWSERS_PATH=/home/dcagent/.cache/ms-playwright "$NODE" "$RELEASE/.pma/chat-convergence-proofs/chat-live-ai-browser-proof.mjs" > "$EVIDENCE/ai-browser.out" 2> "$EVIDENCE/ai-browser.err"; then
  ai_rc=0
else
  ai_rc=$?
fi
printf '%s\n' "$ai_rc" > "$EVIDENCE/ai-browser.rc"
[ "$ai_rc" -eq 0 ] || fail AI_BROWSER_EXIT "$ai_rc"
assert_proof ai-browser
cd "$RELEASE"
run_gate saved-live "$NODE" --env-file="$RELEASE/apps/gateway-api/.env" --import tsx "$RELEASE/.pma/chat-convergence-proofs/chat-live-saved-proof.ts"
assert_proof saved-live
if env HOME=/home/dcagent PLAYWRIGHT_BROWSERS_PATH=/home/dcagent/.cache/ms-playwright "$NODE" --env-file="$RELEASE/apps/gateway-api/.env" --import tsx "$RELEASE/.pma/chat-convergence-proofs/chat-live-dm-browser-proof.ts" > "$EVIDENCE/dm-browser.out" 2> "$EVIDENCE/dm-browser.err"; then
  dm_rc=0
else
  dm_rc=$?
fi
printf '%s\n' "$dm_rc" > "$EVIDENCE/dm-browser.rc"
[ "$dm_rc" -eq 0 ] || fail DM_BROWSER_EXIT "$dm_rc"
assert_proof dm-browser
printf '%s,%s,%s\n' 'ai_browser' 'PASS' 'canonical stream with zero hybrid final-answer requests' >> "$EVIDENCE/validations.csv"
printf '%s,%s,%s\n' 'saved_isolation' 'PASS' 'two-user isolation and cross-user 404' >> "$EVIDENCE/validations.csv"
printf '%s,%s,%s\n' 'direct_messages' 'PASS' 'typing, realtime, read receipt, reload persistence, DB shape and cleanup' >> "$EVIDENCE/validations.csv"
printf '%s\n' 'PASS' > "$EVIDENCE/stage_browser.txt"
record_progress browser PASS 'AI, saved-chat and direct-message live proofs verified'
"$PM2" save > "$EVIDENCE/pm2-save.stdout.txt" 2> "$EVIDENCE/pm2-save.stderr.txt" || fail PM2_SAVE_FAILED
[ ! -s "$EVIDENCE/pm2-save.stderr.txt" ] || fail PM2_SAVE_STDERR_NONZERO
printf '%s,%s,%s\n' 'pm2_save' 'PASS' 'process list persisted' >> "$EVIDENCE/actions.csv"
printf '%s\n' 'PASS' > "$EVIDENCE/FINAL_STATUS.txt"
printf '{"status":"PASS","runId":"%s","release":"%s","ai":"PASS","savedIsolation":"PASS","directMessages":"PASS"}\n' "$RUN_ID" "$RELEASE" > "$EVIDENCE/summary.json"
printf '{"runId":"%s","release":"%s","status":"PASS","stage":"closeout"}\n' "$RUN_ID" "$RELEASE" > "$EVIDENCE/checkpoint.json"
printf '# Watany Chat Convergence V1 Deployment\n\nStatus: PASS\n\nRelease: `%s`\n\nGateway typecheck: PASS\n\nWeb typecheck/build: PASS\n\nMigrations: PASS\n\nAI chat browser: PASS\n\nSaved-chat isolation: PASS\n\nDirect realtime messaging: PASS\n\nSuccess token: `WATANY_CHAT_CONVERGENCE_V1_PRODUCTION_PASS`\n' "$RELEASE" > "$EVIDENCE/FINAL_REPORT.md"
record_progress closeout PASS 'deployment and complete chat proofs passed'
log 'PROGRAM_STATUS=PASS'
log 'FIRST_FAILURE=NONE'
log 'WATANY_CHAT_CONVERGENCE_V1_PRODUCTION_PASS'
log "CURRENT=$(readlink -f "$CURRENT_LINK")"
log "REPORT_ROOT=$EVIDENCE"
seal_report || fail REPORT_MANIFEST_VERIFY_FAILED
trap - ERR
printf '%s\n' 'PROGRAM_STATUS=PASS'
printf '%s\n' 'FIRST_FAILURE=NONE'
printf '%s\n' 'WATANY_CHAT_CONVERGENCE_V1_PRODUCTION_PASS'
printf 'CURRENT=%s\n' "$(readlink -f "$CURRENT_LINK")"
printf 'REPORT_ROOT=%s\n' "$EVIDENCE"
exit 0
