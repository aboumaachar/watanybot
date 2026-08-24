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

EXPECTED_BRANCH="integration/theme-upgrade-20260728"
PUBLIC_BASE="/ops/"
PUBLIC_URL="https://koudama.com/ops/"
API_URL="https://koudama.com/mcp"
WEB_USER_ORIGIN="https://koudama.com"

fail() {
  printf '\nWATANYBOT WEB-ADMIN DEPLOYMENT: FAILED\n%s\n' "$1" >&2
  exit 1
}

rollback() {
  if [ "$DEPLOYED" -eq 1 ] && [ -s "$BACKUP" ]; then
    rm -rf "$LIVE"
    mkdir -p "$LIVE"
    tar -xzf "$BACKUP" --no-same-owner -C "$LIVE"
    printf 'ROLLBACK: PASS\n'
  fi
}

trap 'rollback' ERR

[ "$(id -un)" = "koudama" ] || fail "Deployment must run as the cPanel user koudama."
[ -d "$REPO/.git" ] || fail "Repository not found: $REPO"
[ -d "$WEB_ROOT" ] || fail "web-admin source not found: $WEB_ROOT"
command -v curl >/dev/null 2>&1 || fail "curl is required."

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
"${PNPM[@]}" --dir "$WEB_ROOT" build

[ -f "$DIST/index.html" ] || fail "web-admin build did not create dist/index.html."
grep -Eq '(src|href)="/ops/assets/[^"]+\.(js|css)' "$DIST/index.html" || \
  fail "Built web-admin index is not rooted at /ops/assets/."

rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -a "$DIST/." "$STAGE/"

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

sleep 3

MARKER="$(
  curl --fail --silent --show-error --location \
    --header 'Cache-Control: no-cache' \
    "${PUBLIC_URL}.apex-web-admin-deployed-sha?stamp=${STAMP}"
)"
printf '%s' "$MARKER" | grep -Fq "$COMMIT" || fail "Public admin deployment marker mismatch."

INDEX="$(
  curl --fail --silent --show-error --location \
    --header 'Cache-Control: no-cache' \
    "${PUBLIC_URL}?stamp=${STAMP}"
)"
printf '%s' "$INDEX" | grep -Eiq '<!doctype html|<div id="?root"?' || \
  fail "web-admin shell not found at ${PUBLIC_URL}."

DEEP="$(
  curl --fail --silent --show-error --location \
    --header 'Cache-Control: no-cache' \
    "${PUBLIC_URL}admin/documents?stamp=${STAMP}"
)"
printf '%s' "$DEEP" | grep -Eiq '<!doctype html|<div id="?root"?' || \
  fail "web-admin SPA deep-link fallback failed."

ASSET_PATH="$(printf '%s' "$INDEX" | grep -oE 'src="/ops/assets/[^"]+\.js' | head -n 1 | cut -c 6-)"
[ -n "$ASSET_PATH" ] || fail "web-admin index did not expose a /ops asset."
curl --fail --silent --show-error --location \
  --header 'Cache-Control: no-cache' \
  "https://koudama.com${ASSET_PATH}?stamp=${STAMP}" > /dev/null

DEPLOYED=0
trap - ERR

printf '\nWATANYBOT WEB-ADMIN DEPLOYMENT: PASS\n'
printf 'Commit: %s\n' "$COMMIT"
printf 'Public URL: %s\n' "$PUBLIC_URL"
printf 'Live path: %s\n' "$LIVE"
printf 'Backup: %s\n' "$BACKUP"