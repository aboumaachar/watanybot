#!/usr/bin/env bash
set -Eeuo pipefail

REPO="/home/koudama/repositories/watanybot"
WEB_ROOT="${REPO}/apps/web-admin"
DIST="${WEB_ROOT}/dist"
PUBLIC_PARENT="/home/koudama/public_html"
LIVE="${PUBLIC_PARENT}/ops"
STAMP="$(date +%Y%m%d-%H%M%S)"
STAGE="/home/koudama/.watany-admin-stage-${STAMP}"
BACKUP="/home/koudama/watany-admin-ops-${STAMP}.tar.gz"
DEPLOYED=0
HTTP_PROOF_DIR=""

EXPECTED_BRANCH="integration/theme-upgrade-20260728"
PUBLIC_BASE="/ops/"
PUBLIC_URL="https://koudama.com/ops/"
API_URL="https://koudama.com/mcp"
WEB_USER_ORIGIN="https://koudama.com"
PAYLOAD_CMS_URL="https://payload.koudama.com"

rollback() {
  if [ "$DEPLOYED" -ne 1 ]; then
    return 0
  fi
  [ -s "$BACKUP" ] || return 1
  rm -rf "$LIVE" || return 1
  mkdir -p "$LIVE" || return 1
  tar -xzf "$BACKUP" --no-same-owner -C "$LIVE" || return 1
  DEPLOYED=0
  printf 'ROLLBACK: PASS\n'
}

cleanup_temp() {
  if [ -n "$HTTP_PROOF_DIR" ] && [ -d "$HTTP_PROOF_DIR" ]; then
    rm -rf "$HTTP_PROOF_DIR" || true
  fi
}

fail() {
  local message="$1"
  printf '\nWATANYBOT WEB-ADMIN DEPLOYMENT: FAILED\n%s\n' "$message" >&2
  if [ "$DEPLOYED" -eq 1 ]; then
    trap - ERR
    if ! rollback; then
      printf 'ROLLBACK: FAIL\n' >&2
      cleanup_temp
      exit 2
    fi
  fi
  cleanup_temp
  exit 1
}

on_error() {
  local rc=$?
  trap - ERR
  if [ "$DEPLOYED" -eq 1 ] && ! rollback; then
    printf 'ROLLBACK: FAIL\n' >&2
    cleanup_temp
    exit 2
  fi
  cleanup_temp
  exit "$rc"
}

trap 'on_error' ERR

[ "$(id -un)" = "koudama" ] || fail "Deployment must run as the cPanel user koudama."
[ -d "$REPO/.git" ] || fail "Repository not found: $REPO"
[ -d "$WEB_ROOT" ] || fail "web-admin source not found: $WEB_ROOT"
[ -f "$WEB_ROOT/src/pages/UniversalFormsAdminPage.tsx" ] || fail "cPanel repo is behind current Universal Forms authority; reconcile source before deployment."
[ -f "$WEB_ROOT/src/pages/UnifiedJobsCatalogPanel.tsx" ] || fail "cPanel repo is behind current Unified Jobs authority; reconcile source before deployment."
[ -f "$WEB_ROOT/src/components/forms/FormCreatorPlugin.tsx" ] || fail "cPanel repo is behind current Form Creator authority; reconcile source before deployment."
[ -f "$WEB_ROOT/scripts/verify-ops-build.mjs" ] || fail "web-admin /ops build verifier is missing."
[ -f "$REPO/scripts/verify-ops-staged-browser.mjs" ] || fail "staged /ops browser verifier is missing."
command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v node >/dev/null 2>&1 || fail "node is required."
command -v cmp >/dev/null 2>&1 || fail "cmp is required."
command -v find >/dev/null 2>&1 || fail "find is required."

cd "$REPO"

BRANCH="$(git branch --show-current)"
STATUS="$(git status --porcelain --untracked-files=all)"
COMMIT="$(git rev-parse HEAD)"

[ "$BRANCH" = "$EXPECTED_BRANCH" ] || fail "Unexpected branch: $BRANCH"
[ -z "$STATUS" ] || fail "Repository worktree is not clean."

export PATH="${HOME}/.local/bin:${HOME}/bin:${PATH}"

if command -v pnpm >/dev/null 2>&1; then
  PNPM=(pnpm)
elif command -v corepack >/dev/null 2>&1; then
  PNPM=(corepack pnpm)
elif command -v npm >/dev/null 2>&1; then
  LOCAL_PREFIX="${HOME}/.local"
  PNPM_BIN="${LOCAL_PREFIX}/bin/pnpm"

  if [ ! -x "$PNPM_BIN" ]; then
    mkdir -p "$LOCAL_PREFIX"
    npm install --global --prefix "$LOCAL_PREFIX" pnpm@10.34.1
  fi

  [ -x "$PNPM_BIN" ] || fail "pnpm installation failed."
  PNPM=("$PNPM_BIN")
else
  fail "pnpm, corepack, and npm are unavailable."
fi

"${PNPM[@]}" install --frozen-lockfile --ignore-scripts

VITE_BASE="$PUBLIC_BASE" \
VITE_API_URL="$API_URL" \
VITE_WEB_USER_ORIGIN="$WEB_USER_ORIGIN" \
VITE_PAYLOAD_CMS_URL="$PAYLOAD_CMS_URL" \
"${PNPM[@]}" --dir "$WEB_ROOT" build

[ -f "$DIST/index.html" ] || fail "web-admin build did not create dist/index.html."
grep -Eq '(src|href)="/ops/assets/[^"]+\.(js|css)' "$DIST/index.html" || \
  fail "Built web-admin index is not rooted at /ops/assets/."
node "$WEB_ROOT/scripts/verify-ops-build.mjs" "$DIST" || \
  fail "Built web-admin failed the /ops emitted-artifact gate."

RUNTIME_EXTENSION_REF=""
RUNTIME_EXTENSION_SOURCE=""
if [ -f "$LIVE/index.html" ]; then
  mapfile -t RUNTIME_EXTENSION_REFS < <(grep -oE '/ops/assets/ops-runtime-extension-v2-[A-Za-z0-9._-]+\.js' "$LIVE/index.html" || true)
  [ "${#RUNTIME_EXTENSION_REFS[@]}" -le 1 ] || fail "Live /ops index contains multiple runtime-extension references."
  if [ "${#RUNTIME_EXTENSION_REFS[@]}" -eq 1 ]; then
    RUNTIME_EXTENSION_REF="${RUNTIME_EXTENSION_REFS[0]}"
    RUNTIME_EXTENSION_SOURCE="$LIVE/${RUNTIME_EXTENSION_REF#/ops/}"
    [ -s "$RUNTIME_EXTENSION_SOURCE" ] || fail "Live runtime-extension reference has no readable source file."
  fi
fi

rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -a "$DIST/." "$STAGE/"

if [ -n "$RUNTIME_EXTENSION_REF" ]; then
  RUNTIME_EXTENSION_STAGE="$STAGE/${RUNTIME_EXTENSION_REF#/ops/}"
  mkdir -p "$(dirname "$RUNTIME_EXTENSION_STAGE")"
  cp "$RUNTIME_EXTENSION_SOURCE" "$RUNTIME_EXTENSION_STAGE"
  RUNTIME_EXTENSION_REF="$RUNTIME_EXTENSION_REF" STAGE_INDEX="$STAGE/index.html" node <<'NODE'
const fs = require('node:fs');
const p = process.env.STAGE_INDEX;
const ref = process.env.RUNTIME_EXTENSION_REF;
let html = fs.readFileSync(p, 'utf8');
if ((html.split(ref).length - 1) !== 0) throw new Error('RUNTIME_EXTENSION_ALREADY_PRESENT');
const close = '</head>';
if ((html.split(close).length - 1) !== 1) throw new Error('HEAD_CLOSE_CARDINALITY');
html = html.replace(close, `    <script defer src="${ref}"></script>\n  ${close}`);
fs.writeFileSync(p, html, 'utf8');
NODE
fi

node "$WEB_ROOT/scripts/verify-ops-build.mjs" "$STAGE" || \
  fail "Staged web-admin failed the /ops emitted-artifact gate."
node "$REPO/scripts/verify-ops-staged-browser.mjs" "$STAGE" || \
  fail "Staged web-admin failed the pre-cutover browser gate."

cat > "$STAGE/.htaccess" <<'HTACCESS'
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /ops/
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /ops/index.html [L]
</IfModule>
HTACCESS

printf '%s\n' "$COMMIT" > "$STAGE/.apex-web-admin-deployed-sha"

[ -f "$STAGE/index.html" ] || fail "Staged admin release has no index.html."
[ -f "$STAGE/.htaccess" ] || fail "Staged admin release has no .htaccess."
[ -f "$STAGE/.apex-web-admin-deployed-sha" ] || fail "Staged deployment marker missing."

if [ -d "$LIVE" ]; then
  tar -czhf "$BACKUP" -C "$LIVE" .
else
  mkdir -p "$LIVE"
  tar -czhf "$BACKUP" --files-from /dev/null
fi

[ -s "$BACKUP" ] || fail "Admin backup was not created."

rm -rf "$LIVE"
mkdir -p "$LIVE"
tar --no-same-owner -C "$STAGE" -cf - . | tar --no-same-owner -xf - -C "$LIVE"
DEPLOYED=1

find "$LIVE" -type d -exec chmod 755 {} +
find "$LIVE" -type f -exec chmod 644 {} +
node "$WEB_ROOT/scripts/verify-ops-build.mjs" "$LIVE" || \
  fail "Live web-admin failed the local /ops emitted-artifact gate after cutover."

sleep 3
HTTP_PROOF_DIR="$(mktemp -d "${HOME}/.watany-admin-http-proof-${STAMP}-XXXXXX")"

MARKER_PATH="$HTTP_PROOF_DIR/marker.txt"
curl --fail --silent --show-error --location \
  --header 'Cache-Control: no-cache' \
  "${PUBLIC_URL}.apex-web-admin-deployed-sha?stamp=${STAMP}" \
  --output "$MARKER_PATH"
grep -Fqx "$COMMIT" "$MARKER_PATH" || fail "Public admin deployment marker mismatch."

INDEX_PATH="$HTTP_PROOF_DIR/index.html"
curl --fail --silent --show-error --location \
  --header 'Cache-Control: no-cache' \
  "${PUBLIC_URL}?stamp=${STAMP}" \
  --output "$INDEX_PATH"
cmp -s "$STAGE/index.html" "$INDEX_PATH" || fail "Public /ops index bytes differ from the staged release."

for route in admin/documents jobs forms; do
  DEEP_PATH="$HTTP_PROOF_DIR/deep-${route//\//-}.html"
  curl --fail --silent --show-error --location \
    --header 'Cache-Control: no-cache' \
    "${PUBLIC_URL}${route}?stamp=${STAMP}" \
    --output "$DEEP_PATH"
  cmp -s "$STAGE/index.html" "$DEEP_PATH" || fail "SPA deep-link fallback bytes differ for /ops/${route}."
done

ASSET_COUNT=0
while IFS= read -r asset_name; do
  [ -n "$asset_name" ] || continue
  ASSET_COUNT=$((ASSET_COUNT + 1))
  ASSET_HTTP="$HTTP_PROOF_DIR/$asset_name"
  curl --fail --silent --show-error --location \
    --header 'Cache-Control: no-cache' \
    "https://koudama.com/ops/assets/${asset_name}?stamp=${STAMP}" \
    --output "$ASSET_HTTP"
  cmp -s "$STAGE/assets/$asset_name" "$ASSET_HTTP" || fail "Public asset bytes differ: $asset_name"
done < <(find "$STAGE/assets" -maxdepth 1 -type f -printf '%f\n' | LC_ALL=C sort)
[ "$ASSET_COUNT" -gt 0 ] || fail "No staged web-admin assets were verified."
printf 'PUBLIC_ASSET_PARITY_COUNT=%s\n' "$ASSET_COUNT"

if [ -n "$RUNTIME_EXTENSION_REF" ]; then
  RUNTIME_EXTENSION_NAME="${RUNTIME_EXTENSION_REF##*/}"
  cmp -s "$STAGE/assets/$RUNTIME_EXTENSION_NAME" "$HTTP_PROOF_DIR/$RUNTIME_EXTENSION_NAME" || \
    fail "Runtime extension hash parity failed."
  printf 'RUNTIME_EXTENSION_PRESERVED=PASS\n'
fi

cleanup_temp
HTTP_PROOF_DIR=""
DEPLOYED=0
trap - ERR

printf '\nWATANYBOT WEB-ADMIN DEPLOYMENT: PASS\n'
printf 'Commit: %s\n' "$COMMIT"
printf 'Public URL: %s\n' "$PUBLIC_URL"
printf 'Live path: %s\n' "$LIVE"
printf 'Backup: %s\n' "$BACKUP"
